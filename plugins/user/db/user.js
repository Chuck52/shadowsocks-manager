const knex = appRequire('init/knex').knex;
const tableName = 'user';

const createTable = async() => {
  const exist = await knex.schema.hasTable(tableName);
  if(exist) {
    const hasColumnGroup = await knex.schema.hasColumn(tableName, 'group');
    if(!hasColumnGroup) {
      await knex.schema.table(tableName, function(table) {
        table.integer('group').defaultTo(0);
      });
    }
    const hasComment = await knex.schema.hasColumn(tableName, 'comment');
    if(!hasComment) {
      await knex.schema.table(tableName, function(table) {
        table.string('comment').defaultTo('');
      });
    }
    const hasEthAccount = await knex.schema.hasColumn(tableName, 'eth_account');
    if(!hasEthAccount) {
      await knex.schema.table(tableName, function(table) {
        table.string('eth_account').defaultTo('').unique();
        table.index('eth_account');
      });
    }
    return;
  }
  return knex.schema.createTable(tableName, function(table) {
    table.increments('id').primary();
    table.string('username').unique();
    table.string('email');
    table.string('telegram');
    table.string('password');
    table.string('type');
    table.bigInteger('createTime');
    table.bigInteger('lastLogin');
    table.string('resetPasswordId');
    table.bigInteger('resetPasswordTime');
    table.integer('group').defaultTo(0);
    table.string('comment').defaultTo('');
    table.string('smt_account').unique();

    table.index('smt_account');
  });
};

exports.createTable = createTable;
