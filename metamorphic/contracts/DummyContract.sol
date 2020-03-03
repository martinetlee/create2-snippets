pragma solidity 0.5.16;

import "./MetamorphicFactory.sol";

contract DummyContract {
  
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

  function whoAreYou() public pure returns (string memory){
    return "Dummy";
  }

  function destroy() public {
    selfdestruct(address(0x0));
  }

}

/*
// On Etherscan, trying to verify a contract that is deployed with the contract above
// with the code below would fail
// This is likely because etherscan checks the creationCode, instead of only comparing 
// the runtime bytecode

contract DummyContract {
  
  constructor() public {
    // This constructor is totally innocent.
    // Nothing bad will ever happen here.
  }

  function whoAreYou() public pure returns (string memory){
    return "Dummy";
  }

  function destroy() public {
    selfdestruct(address(0x0));
  }
}
*/