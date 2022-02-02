const AWS = require("aws-sdk");

const dynamodb = new AWS.DynamoDB.DocumentClient({ region: "eu-central-1" });
const USER_TABLE =
  process.env.USER_TABLE || "serverless-ws-test-dev-UserTable-MNQE1DBT8VVK";

exports.update = async (username) => {
  return await dynamodb
    .update({
      TableName: USER_TABLE,
      Key: { username },
      ReturnValues: "ALL_NEW",
    })
    .promise();
};

exports.scan = async () => {
  return await dynamodb
    .scan({
      TableName: USER_TABLE,
    })
    .promise();
};
