const config = require('config');
const Datastore = require('nedb');
const path = require("path");

let database;

const getDatabase = () => {
  return new Promise((resolve, reject) => {
    if (database) {
      resolve(database);
      return;
    }

    const databasePath = path.resolve(config.database.directory);
    const filename = `${databasePath}/${config.database.name}.nedb`;
    const db = new Datastore({ filename });
    db.loadDatabase(error => {
      if (error) {
        reject(error);
        return;
      }

      database = db;
      resolve(database);
    });
  });
}

const find = id => {
  return new Promise((resolve, reject) => {
    getDatabase().then(database => {
      database.find({ id }).exec((error, records) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(records);
      });
    }).catch(error => {
      reject(error);
    });
  });
}

const update = (id, record) => {
  record.id = id;
  return new Promise((resolve, reject) => {
    getDatabase().then(database => {
      database.update({ id },  record, { upsert: true }, error => {
        if (error) {
          reject(error);
          return;
        }

        resolve(record);
      });
    }).catch(error => {
      reject(error);
    });
  });
}

module.exports = { find, update };
