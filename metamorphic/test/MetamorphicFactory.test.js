const Utils = require("./Utils.js");

const MetamorphicFactory = artifacts.require("MetamorphicFactory");
const DummyContract = artifacts.require("DummyContract");
const QuestionButterfly = artifacts.require("QuestionButterfly");

const { abi: DummyABI, bytecode: DummyByteCode } = require('../build/contracts/DummyContract.json');
const { abi: QuestionButterflyAbi, deployedBytecode: QuestionButterflyByteCode } = require('../build/contracts/QuestionButterfly.json');

contract("MetamorphicFactory", async function(accounts) {
  
  beforeEach(async function(){
    factory = await MetamorphicFactory.new();
  });

  it("Factory can succesfully deploy DummyContract contract and should match off-chain calculation", async function(){
    console.log("-------------------------------------------------------------------------------------------------------");
    let salt = 100;
    let offchainCalculatedAddress = Utils.calCreate2Address(factory.address, salt, DummyByteCode);

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
    let dummyContract = await DummyContract.at(args['contractAddr']);

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
    await dummyContract.destroy();

    console.log("Deploying contract for the 3rd time after the contract has been destructed");
    Utils.assertEvent({
      result: await factory.deployContract(salt),
      name: "ContractDeployed",
      args: callArgs => {
        args = callArgs;
      }
    });
    let identity = await dummyContract.whoAreYou();
    console.log("Identity of deployed contract: " + identity);
    console.log("\tDeployed contract address :" + args['contractAddr']);
    console.log("This should be the same address as the off-chain calculation");
    console.log("which means: (1) it succesfully deployed (2) it deployed to the same address");
    console.log(await web3.eth.getCode(args['contractAddr']));

    // Make the switch
    await factory.setTimeToMorph(true);
    // the creationCode is the initCode, since we don't have any argument in the constructor
    await factory.setRealInitCode(QuestionButterflyByteCode);
    console.log("Invoking destruction...");
    await dummyContract.destroy();

    console.log("Deploying contract for the 3rd time after the contract has been destructed");
    Utils.assertEvent({
      result: await factory.deployContract(salt),
      name: "ContractDeployed",
      args: callArgs => {
        args = callArgs;
      }
    });
    let butterflyContract = await QuestionButterfly.at(args['contractAddr']);
    identity = await butterflyContract.whoAreYou();
    console.log("Identity of deployed contract: " + identity);
    console.log("\tDeployed contract address :" + args['contractAddr']);
    console.log("This should be the same address as the off-chain calculation, but with different identiy");
    console.log("which means: (1) it succesfully deployed (2) it deployed to the same address (3) A different contract has been deployed to the same address");
  });

});