pragma solidity 0.5.16;

contract DeployMe{
  constructor() public {}

  function hail() public pure returns (bytes memory) {
    return "Helo";
  }

  function destroy() public {
    // self destructs and send all the funds to somewhere I don't care
    selfdestruct(address(0x0));
  }
}