pragma solidity 0.5.16;

import "./DummyContract.sol";

contract MetamorphicFactory {
  
  constructor() public {}

  event ContractDeployed(address contractAddr);

  bytes public realInitCode;
  bool public timeToMorph;


  function setRealInitCode(bytes memory providedInitCode) public {
    realInitCode = providedInitCode;
  }

  function setTimeToMorph(bool isItTimeToMorph) public {
    timeToMorph = isItTimeToMorph;
  }

  function deployContract(uint256 salt) public {
    // As there is no argument for the contract DeployMe
    // the creationCode is the initCode
    bytes memory initCode = type(DummyContract).creationCode;

    address deployedContract;
    assembly{
      deployedContract := create2(0, add(initCode, 0x20), mload(initCode), salt)
    }
    emit ContractDeployed(deployedContract);
  }

}