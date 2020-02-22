pragma solidity 0.5.16;

import "./DeployMe.sol";

contract Create2Factory{
  
  constructor() public {}

  event ContractDeployed(address contractAddr);

  function deployContract(uint256 salt) public {
    // As there is no argument for the contract DeployMe
    // the creationCode is the initCode
    bytes memory initCode = type(DeployMe).creationCode;

    address deployedContract;
    assembly{
      deployedContract := create2(0, add(initCode, 0x20), mload(initCode), salt)
    }
    emit ContractDeployed(deployedContract);
  } 
}