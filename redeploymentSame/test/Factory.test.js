const Utils = require("./Utils.js");

const Create2Factory = artifacts.require("Create2Factory");
const DeployMe = artifacts.require("DeployMe");

const { abi: DeployMeABI, bytecode: DeployMeByteCode } = require('../build/contracts/DeployMe.json');

contract("Factory", async function(accounts) {
  
  beforeEach(async function(){
    factory = await Create2Factory.new();
  });

  it("Factory can succesfully deploy DeployMe contract and should match off-chain calculation", async function(){
    console.log("-------------------------------------------------------------------------------------------------------");
    let salt = 100;
    let offchainCalculatedAddress = Utils.calCreate2Address(factory.address, salt, DeployMeByteCode);

    console.log( "Off-chain calculated address: " +  offchainCalculatedAddress);
    console.log("Deploying contract through Create2Factory...");

    Utils.assertEvent({
      result: await factory.deployContract(salt),
      name: "ContractDeployed",
      args: callArgs => {
        args = callArgs;
      }
    });

    console.log("Deployed contract address :" + args['contractAddr']);
    // Use toLowerCase 
    assert.equal(args['contractAddr'].toLowerCase(), offchainCalculatedAddress);
  });

  it("Should fail when trying to redeploy to the same address before selfDestruct", async function(){
    console.log("-------------------------------------------------------------------------------------------------------");
    let salt = 100;
    console.log("Deploying contract for the 1st time through Create2Factory...");

    Utils.assertEvent({
      result: await factory.deployContract(salt),
      name: "ContractDeployed",
      args: callArgs => {
        args = callArgs;
      }
    });
    // Keep track of the deployed contract
    let deployMe = await DeployMe.at(args['contractAddr']);

    console.log("\tDeployed contract address :" + args['contractAddr']);

    console.log("Deploying contract for the 2nd time when the contract is present...");
    Utils.assertEvent({
      result: await factory.deployContract(salt),
      name: "ContractDeployed",
      args: callArgs => {
        args = callArgs;
      }
    });
    console.log("\tDeployed contract address :" + args['contractAddr']);
    console.log("The above should be all 0x0, indicate that it failed to deploy.");
    console.log("Now we will destruct the contract, then redeploy.");

    console.log("Invoking destruction...");
    await deployMe.destroy();

    console.log("Deploying contract for the 3rd time after the contract has been destructed");
    Utils.assertEvent({
      result: await factory.deployContract(salt),
      name: "ContractDeployed",
      args: callArgs => {
        args = callArgs;
      }
    });
    console.log("\tDeployed contract address :" + args['contractAddr']);
    console.log("This should be the same address as the off-chain calculation");
    console.log("which means: (1) it succesfully deployed (2) it deployed to the same address");
  });

});