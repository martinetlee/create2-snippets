# Create2-Snippets

This repository provides some code snippets that are useful for `create2` that was introduced in Ethereum Constantinople update. 

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

```javascript

```

* If the contract's constructor has arguments:

```javascript


```

## Off-chain address calculation


## Mixing create2 with Proxy pattern

### Method 1: mix the `msg.sender` with salt

### Method 2: initialize the proxy in the same transaction



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

MetamorphicFactory: https://rinkeby.etherscan.io/address/0x940fe419f7b3460f38e60a850676b7235d5ae792#code

DummyContract: https://rinkeby.etherscan.io/address/0x536a9181b6bf94822fb0aad25a1bf56e04c3d079#code



