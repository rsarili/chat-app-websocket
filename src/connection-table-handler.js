const AWS = require("aws-sdk");

const dynamodb = new AWS.DynamoDB.DocumentClient({ region: "eu-central-1" });
const connectionTable =
  process.env.CONNECTION_TABLE ||
  "serverless-ws-test-dev-WebsocketConnectionTable-BQGDCLQB7H9C";

exports.put = async (connectionId, username) => {
  await dynamodb
    .put({
      TableName: connectionTable,
      Item: {
        connectionId,
        username,
      },
    })
    .promise();
};

exports.get = async (connectionId) => {
  return await dynamodb
    .get({
      TableName: connectionTable,
      Key: {
        connectionId,
      },
    })
    .promise();
};

exports.scan = async () => {
  return await dynamodb
    .scan({
      TableName: connectionTable,
    })
    .promise();
};

exports.delete = async (connectionId) => {
  await dynamodb
    .delete({
      TableName: connectionTable,
      Key: { connectionId },
    })
    .promise();
};

exports.getByUsername = async (username) => {
  console.log(connectionTable);
  return await dynamodb
    .query({
      TableName: connectionTable,
      IndexName: "UsernameIndex",
      KeyConditionExpression: "username = :u",
      ExpressionAttributeValues: { ":u": username },
    })
    .promise();
};
