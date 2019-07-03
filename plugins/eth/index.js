const log4js = require('log4js');
const logger = log4js.getLogger('eth');
const Web3 = require('web3');
const knex = appRequire('init/knex').knex;
const account = appRequire('plugins/account/index');
const sleep = time => new Promise(resolve => setTimeout(resolve, time));

// 加载配置
const config = appRequire('services/config').all();
const receiveAccount = config.plugins.eth.receive_account;
const endpoint= config.plugins.eth.rpc_endpoint;
const confirmBlock = config.plugins.eth.confirm_block;
const queryPeriod = config.plugins.eth.query_period;

// 建立连接
let w = new Web3(new Web3.providers.WebsocketProvider(endpoint));


const isInvalidTx = (tx) => {
  if (tx === null) return false;
  if (tx.to === null) return false;
  return tx.to.toLowerCase() === receiveAccount.toLowerCase();
};

/*
处理一笔收到的交易
 */
async function handleReceiveTransaction(txr) {
    // 0. 获取tx
    console.log(txr);
    const tx = await w.eth.getTransaction(txr.transactionHash);
    // 1. 根据交易金额查询我们的smt套餐,todo 如果不存在,忽略
    const amount = w.utils.fromWei(tx.value);
    const orderInfo = await knex('webgui_order').where({ eth: amount }).then(s => s[0]);
    if(!orderInfo) {
        logger.warn("ignore received eth because can not find order with amount %d ", tx.value);
        return;
    }
    // 2. 查询交易发送方地址是否在我们的用户列表中注册,todo 如果不存在,忽略
    let addr = txr.from.toLowerCase();
    const user = await knex('user').where({eth_account:addr}).then(s => s[0]);
    if(!user) {
        logger.warn("ignore received eth because can not find user by payer %s ", txr.from);
        return;
    }
    // 3. 根据用户查询账户,todo 目前仅支持一个用户一个账户
    const accountInfo = await knex('account_plugin').where({ userId: user.id }).then(s => s[0]);
    // 4. 添加流量
    await account.setAccountLimit(user.id, accountInfo.id, orderInfo.id);
}

function confirmEtherTransaction(txHash, confirmations = 0) {
    setTimeout(async () => {
        // 1. 获取receipt
        const txr = await w.eth.getTransactionReceipt(txHash);
        if (txr == null ) {
            // 递归
            return confirmEtherTransaction(txHash, confirmations);
        }
        if (!txr.status) {
            // 打包正常,执行失败
            logger.warn("confirm tx FAIL : [txHash=%s packBlock=%d] ", txHash,txr.blockNumber);
            return;
        }
        // 2. 获取当前块并验证是否足够确认块
        const currentBlock = await w.eth.getBlockNumber();
        if (currentBlock - txr.blockNumber < confirmations) {
            // 递归
            return confirmEtherTransaction(txHash, confirmations);
        }
        // 3. 后续处理
        logger.info("confirm tx SUCCESS : [txHash=%s packBlock=%d confirmBlock=%d] ", txHash,txr.blockNumber, currentBlock);
        await handleReceiveTransaction(txr);
    }, 1000);
}

const dealNewBlockHeaders =  async (block) => {
    try {
        await sleep(3000); // 等待infura同步数据
        let count = await w.eth.getBlockTransactionCount(block.number);
        if (count === null) {
            return await dealNewBlockHeaders(block);
        }
        for (let i=0; i < count; i++) {
            let tx = await w.eth.getTransactionFromBlock(block.number, i);
            if (!isInvalidTx(tx)) continue;
            logger.info("receive tx : [payer=%s amount=%d txHash=%s]",tx.from, tx.value, tx.hash);
            // 3. 确认交易,这里打包并等待一块就够了,或者只打包就够了?
            confirmEtherTransaction(tx.hash, confirmBlock);
        }
    }catch (e) {
        logger.error("dealPendingTx err : " + e);
    }
};

/*
    start
 */
if (config.plugins.eth.use) {
    w.eth.subscribe('newBlockHeaders', function(error, result){
        if (error) {
            logger.error("subscribe newBlockHeaders error : " + error);
        }
    })
        .on("data", dealNewBlockHeaders)
        .on('error', async (error) => {
            logger.error("subscribe newBlockHeaders error : " + error);
        });
    logger.info("start eth plugin with rpc_endpoint=%s receive_account=%s",endpoint, receiveAccount);
}

