# Create2-Snippets

This repository provides some code snippets that are useful for `create2` that was introduced in Ethereum Constantinople update. 

## Disclaimer

All the code presented here is for educational purposes and is intentionally simplified. It is certainly not designed with all the security considerations in mind, in fact, some of those are ripped off to make it glaringly clear on the core code I wanted to demonstrate.

Do not use the code here in production whatsoever.

## Environment

The article uses the following environment for solidity development and testing:
* Solidity: 0.5.16
* Truffle: 5.1.9
* ganache-cli: 6.9.0
* Node: 11.15.0

## Basic concepts

`create2` is a new opCode that has been introduced into Ethereum in the Constantinople update and provides a new way for contracts to deploy contracts. To understand what is going under the hood, we need to know how EVM handles when there's a transaction that tries to deploy a contract.

### The three kind of bytecodes

When we compile a contract, it turns into bytecode that can be run in EVM. There are two kinds of bytecode that would be the product of the compilation. The first piece of bytecode is called the `initCode` and only exists and being executed when the contract is being deployed. The `initCode` manipulates storage, and in the end it returns the bytecode that would stay in the EVM storage space. The bytecode it returns is the `runtime bytecode` and is what we typically refer to as the deployed smart contract. If you only code through solidity, then you could make the following analogy:

* `initCode`: the constructor of the smart contract that is being deployed, along with its arguments
* `runtime bytecode`: everything except the constructor in the smart contract

Indeed, the smart contract we write in solidity will actually be broken down after we compiled it. This is also the reason why in solidity the "constructor" doesn't exist when you try to call it in other functions of the same contract. 

When you compile with solidity (without assembly), the compiled code for sure returns the `runtime bytecode` of the smart contract you are deploying. However, one could be more creative and make the `initCode` to be more complex. For example, have the `initCode` to return two different pieces of bytecode based on some condition. This would in turn make the EVM to deploy different `runtime bytecode` under different situations. We will revisit this later and see the creative ways of using `create2`.

The `initCode` can be further broken down into two pieces. One is the `creationCode`, which can be viewed as the `constructor` logic, and the arguments that are provided to the `constructor`. They are concatenated together to form the `initCode`. 

Here's a summary of the relationship between `creationCode`, `initCode`, and `runtime bytecode` in terms of pseudocode:

* `initCode` = `creationCode` + (arguments)
* `runtime bytecode` = EVM(`initCode`)

### create2

The way which `create` and `create2` deploys the contract are the same. The only difference is how the address of the deployed contract is being calculated. `create` depends on some blockchain state whereas `create2` is independent of the blockchain state. This independence enables developers to calculate the address with certainty without consluting with the blockchain, in short, we can calculate addresses off-chain.

`create2` calculates the address with: (1) hash of `initCode` (2) salt (3) msg.sender: the address that deploys the new contract.

`create2` is used by one contract to deploy another contract, we will refer to them as factory contract and target contract respectively.

## Deploying contracts with create2

Solidity provides assembly level support for `create2`: `create2(v, p, n, s)`, with `v` being the amount of ether in wei sent along in the transaction, `p` being the start of the `initCode`, `n` being the length of `initCode`, and `s` a 256-bit value. (It also provides higher level support in 0.6.x, but as the 0.6.x are not really production ready because the lack of tools, I would stick to the assembly.)

In Solidity, bytecode can be stored in `bytes memory`, a dynamic bytes array. This is what we would used to store `initCode`. Let's suppose that we have already declared a `bytes memory` variable called `initCode` and it properly stores the `initCode` that is used to deploy a contract. as `s` requires a 256-bit value, we could declare a `uint256 salt` and use it. 

With these, we can deploy a contract with `create2` as follow:

```
assembly{
  deployedContract := create2(0, add(initCode, 0x20), mload(initCode), salt)
}
```

Let's disect the assembly here and gain a deeper understanding. 

As the `initCode` is a dynamic bytes array, in solidity, the first 32 bytes stored in its location is a `uint256` that stores the length of the array. The actual data is stored after those 32 bytes. The `p` requires the start of the actual code, which is the location of our data, thus we would shift the location of `initCode` with 32 bytes: `add(initCode, 0x20)`. `n` asks for the length, which is exactly the first 32 bytes stored in the bytes array, we can use `mload` as it loads the 32 bytes starting from its argument: `mload(initCode)`.

## Now, where do we get the initCode?

As previously described, `initCode` is the piece of bytecode that deploys the smart contract and you would need this for your `create2`. Where could we get them? We can certainly obtain it by compiling the smart contract with `solc`, but that's not the most convenient way to do things. In Solidity, it is possible to obtain the `creationCode` of the target contract `DeployMe` by:

```
bytes memory creationCode = type(DeployMe).creationCode;
```

Recall that creationCode is not the `initCode` yet. If the constructor of the target contract `DeployMe` needs arguments, then you will need to append the encoded arguments after the creationCode. If not, then the `creationCode` would be the `initCode` that we needed. 

* If the contract's contstructor doesn't have arguments: 

```
contract DeployMe{
  constructor(){}
  // ...
}

// ...

bytes memory initCode = creationCode;
```

* If the contract's constructor has arguments: 
```
contract DeployMe{
  constructor(uint256 someNumber, address someAddress){
    // ....
  }
  // ...
}

// ...

bytes memory initCode = abi.encode(creationCode, someNumber, someAddress);
```

The above would come very handy when developing in solidity. To write tests, we would need a way to efficiently load them into javascript. If you use the truffle framework, then the compiled bytecode can be found in the json files of the `build` directory after compilation. 

In the json files, you could find two pieces of bytecode: one labeled as `bytecode` and the other labeled as `deployedBytecode`. The `bytecode` is the `creationCode` and the `deployedBytecode` is the `runtime bytecode` that we have mentioned above. They could be imported through a require statement. 

```javascript
const { abi: DeployMeABI, bytecode: DeployMeCreationCode } = require('../build/contracts/DeployMe.json');
```

We will also need to append the arguments right after the `creationCode` as in Solidity.

* If the contract's contstructor doesn't have arguments: 

```
bytes memory initCode = type(DeployMe).creationCode;
```

* If the contract's constructor has arguments:

```
bytes memory initCode = abi.encodePacked(type(Wallet).creationCode, abi.encode(arg1, arg2, arg3));
```

## Off-chain address calculation


## A super simple smart contract wallet.

One of the use cases of `create2` is that it is now possible for people to send funds to an address that could be later claimed by a certain contract. We will implement the most basic one possible, once the smart contract is instantiated, the owner is able to transfer Ether away to some other address. 

```
contract Wallet{
  address public _owner;
  constructor(owner) public {
    _owner = owner;
  }

  function sendEtherTo(address payable recepient, uint256 amount) public {
    recepient.send(amount);
  }
}
```


```
contract WalletFactory{
  // ....

  function deployWallet(address designatedOwner, uint256 salt){
    
    bytes memory initCode = abi.encodePacked(type(Wallet).creationCode, designatedOwner);

    address deployedContract;
    assembly{
      deployedContract := create2(0, add(initCode, 0x20), mload(initCode), salt)
    }
    emit ContractDeployed(deployedContract);
  }
}
```

Since we use the `owner` for the argument of the Wallet contract, it becomes part of the `initCode` in the WalletFactory. This means that we've guaranteed that given an address calculated with the `initCode` and `salt`, the wallet would be owned by the same `owner` once it is deployed. I call this effect a `Lock`: we've locked the ownership information with the deployed address by incorporating it as part of the constructor arguments. 

Another way to lock information with the deployed address is to incorporate it into the salt, though there is one major difference:

In the context of the deployed contract, the `initCode` lock can execute some code according to the locked information, whereas the `salt` lock could not. While one could execute code in the `deployWallet` method in the factory, it is a weaker guarantee for users as the factory may be upgradable. If the factory is upgradable, the owner of the factory can in fact change the code and thus the information is not guaranteed for the user. 


## Mixing create2 with Proxy pattern

Some developers may want to make the deployed smart contract to be upgradable by using the proxy pattern. This means that the smart contract deployed by the factory would be the proxy that forwards the call to the logic contract. Typically, the proxy needs to be initialized after the deployment and we could only set the variables related to the logic contract when doing initialization (instead of the constructor). While we could certainly do this in the same `deployContract` method in the factory, this would have impact in the address calculation and creates some minor issues that we would need to solve. 

To demonstrate the issue, suppose that we want to make the wallet above upgradable and certainly make the wallet to be owned by the legitimate user. In the non-upgradable version above, the steps are as follow:

1. A user calls the `deployContract`, submitting the argument `salt` and `owner`.
2. Miner executes the transaction, and the following happens atomically:
  * `initCode` is created with constructor arguments: `owner` to claim the ownership.
  * `create2` is called with `salt` and `initCode`

As we can see, in the non-upgradable version, since the `owner` is fixed into the `initCode`, it is guaranteed that the deployed smart contract would be owned by the specified owner.

Now let us make this upgradable. We will need to move the arguments in the constructor arguments to an `initalizer` function and called it later. We will also modify the factory deploy method so that it deploys the proxy then updates the implementation of the proxy to the wallet implementation. (Assuming that the wallet implementation is deployed and recorded in the factory as an address `walletImplementation`.)

```
contract Wallet{
  address public _owner;
  constructor() public {
  }

  function initializer(address owner) public{
    _owner = owner;
  }

  function sendEtherTo(address payable recepient, uint256 amount) public {
    recepient.send(amount);
  }
}
```

We can call the `initializer` function in the `deployWallet` function right after it is being deployed. 

```
contract WalletFactory{
  // .... 
  // this piece of code has security issue, DO NOT USE

  address walletImplementation;

  function deployWallet(address designatedOwner, uint256 salt){
    
    bytes memory initCode = abi.encodePacked(type(Proxy).creationCode);

    address deployedContract;
    assembly{
      deployedContract := create2(0, add(initCode, 0x20), mload(initCode), salt)
    }

    Proxy(deployedContract).updateImplementation(walletImplementation);

    Wallet(deployedContract).initializer(designatedOwner);
    emit ContractDeployed(deployedContract);
  }
}
```


### Oops, we got a problem: Front-running

Recall that we used the constructor arguments to "lock" the address and ownership information in the previous example. Since we are using the proxy pattern, we had claimed ownership using the `initializer` function in the same function. This, however, is susceptible to front-running problem and it is possible to have other people claim ownership of the very same address. 

We can see that the deployed address is not calculated with the ownership information, thus, when the legitimate user submits the `salt` in a transaction, an attacker can submit another transaction with the same `salt` but different `designatedOwner` and a higher gas price. It is likely that miners would then pick up the transaction with the higher gas price and the attacker would have successfully claimed the ownership of the Wallet. 

To solve this, we would want to make the deployed address to be calculated with the ownership information. Apparantly there are two ways of doing this: either you mix the information into the salt, or you put the information into the constructor arguments.


### Method 1: mixing with salt

A new salt can be calculated with the ownership information as below, then used to pass in the `create2` function.

```
bytes32 newSalt = keccak256(abi.encodePacked(salt, designatedOwner));
```

Note: a lot of online tutorial uses `msg.sender` here. I'd like to note that using `msg.sender` as ownership information would limit the system in the sense that only the legitimate owner can deploy the contract himself. By using an input that indicates the ownership information, it allows anyone to help the legitimate owner to deploy the contract. 

Why would someone do this? Well, this is pretty useful if a platform wants to help deploy the contracts on behalf of users so that the users don't need to pay for gas.

### Method 2: still, provide it to the Proxy arguments

As the address is calcualted with the `initCode`, we could also modify the Proxy contract so that it takes the ownership information as the constructor. While this method is "uglier" because one needs to modify the Proxy contract, it CAN (but not necessarily) guarantee a better security for user. 

For example, we could have the Proxy contract to store the ownership information in an unstructured storage:

```
contract Proxy{
// ...
  bytes32 private constant OWNERSHIP_POSITION = keccak256("wallet.ownership.information");
  constructor(address designatedOwner) public {
      bytes32 position = OWNERSHIP_POSITION;
      assembly {
        sstore(position, designatedOwner)
      }
  }
// ...
}
```

Then in the Wallet implementation, the `initializer` reads the ownership information from the same storage:

```
contract Wallet{
  // ...
  bytes32 private constant OWNERSHIP_POSITION = keccak256("wallet.ownership.information");

  function initializer() public{
    address designatedOwner;
    bytes32 position = OWNERSHIP_POSITION;
    assembly {
      designatedOwner := sload(position)
    }
    _owner = designatedOwner; 
  }
  // ...
}
```

## Dealing with solidity-coverage




## Reincarnation: Self-destruct then redeploy the same contract


### Note: How does a reincarnated contract show on EtherScan?


## Metamorphic contracts: Deploying different contracts at the same address

The term Metamorphic contract is beautifully coined by `0age`, his blog post ["The Promise and the Peril of Metamorphic Contracts"](https://medium.com/@0age/the-promise-and-the-peril-of-metamorphic-contracts-9eb8b8413c5e) is very comprehensive and definitely worth a read. Saying a contract to be metamorphic basiccaly means that it is possible to deploy different contracts at the same address via `create2`.

We will use a dummy target contract and mess around with its `constructor`. When we're done, the code would look a bit funky and people might not understand what it is for at first glance, but it would actually deploy some arbitrary contract that is stored somewhere else.

The reason we tinker its `constructor` is that this is the part that is related to its `creationCode` but not the `runtime bytecode` of our dummy target contract. As we've learned in the basic concepts, EVM would deploy whatever bytecode that the initCode returns. Using this, our goal then becomes very simple: we just need the initCode to return arbitrary code that we point to! 

Let's first create a storage for the code and a flag to do bad things in the factory contract:

```
contract MetamorphicFactory {
// ...
  bytes public realInitCode;
  bool public timeToMorph;
// ...
}
```

What I want to do here is when the `timeToMorph` is `true`, then the `deployContract` method should deploy whatever contract I have set in the `realInitCode` and when it is `false`, it should deploy our dummy target contract.

To do this, we can write our contrustor as below:

```
  constructor() public {
    // msg.sender is the factory
    MetamorphicFactory mf = MetamorphicFactory(msg.sender);
    if(mf.timeToMorph() == true){
      // return(p, s) - F end execution, return data mem[p…(p+s))
      bytes memory trueCode = mf.realInitCode();
      assembly{
        return(add(trueCode, 0x20), mload(trueCode))
      }
    }
  }
```

Since the factory deploys the contract, the `msg.sender` then is exactly our factory. Thus we can read the flag and code by converting the `msg.sender` to the factory contract. The only thing left we needed to do is to return the code we wanted to deploy. The assembly `return` takes two parameters: one where the data starts, the other the length of the data. As it is stored in a `bytes memory`, the first 32 bytes is length and the data starts after the 32 bytes. Thus we use `add(trueCode, 0x20)` to indicate the start of the data location, and `mload(trueCode)` to get the length of the data.


### Note: How does metamorphic contract show on Etherscan?

The verification on Etherscan seems to include the "creationCode", therefore one cannot use a contract that would produce the same runtime bytecode to verify the dummy target contract. 


MetamorphicFactory: https://rinkeby.etherscan.io/address/0x940fe419f7b3460f38e60a850676b7235d5ae792#code

DummyContract: https://rinkeby.etherscan.io/address/0x536a9181b6bf94822fb0aad25a1bf56e04c3d079#code



