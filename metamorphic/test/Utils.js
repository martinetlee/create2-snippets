function assertEvent({result, name, args}) {
  assert.equal(result.logs.length, 1);
  assert.equal(result.logs[0].event, name);
  args(result.logs[0].args);
}

async function assertTxFail(promise, msg) {
  let txFailed = false;
  try {
    const result = await promise;
    txFailed = parseInt(result.receipt.status) === 0;
  } catch (err) {
    txFailed =
      err.message.startsWith(
        "VM Exception while processing transaction: revert"
      ) ||
      err.message.startsWith(
        "Returned error: VM Exception while processing transaction: revert"
      );
    if (msg) {
      // assert error message if specified
      assert.isTrue(err.message.endsWith(msg));
    }
  }
  assert.isTrue(txFailed, msg);
}

function calCreate2Address(creatorAddress, salt, init_code){
  shaContent = '0xff' + creatorAddress.slice(2) + numberToUint256(salt).slice(2) + (web3.utils.sha3(init_code)).slice(2);
  addr = "0x" + web3.utils.sha3(shaContent).slice(-40);
  return addr;
}
// converts int to uint256 format
function numberToUint256(value) {
  const hex = value.toString(16)
  const returnMe = `0x${'0'.repeat(64-hex.length)}${hex}`;
  return returnMe;
}

module.exports = {
  assertEvent,
  assertTxFail,
  calCreate2Address,
  numberToUint256
};