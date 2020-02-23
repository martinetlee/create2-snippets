pragma solidity 0.5.16;

contract QuestionButterfly {
  
  constructor() public {}

  function whoAreYou() public pure returns (string memory){
    return "Butterfly";
  }

  function destroy() public {
    selfdestruct(address(0x0));
  }

}