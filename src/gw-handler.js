const AWS = require("aws-sdk");
const apig = new AWS.ApiGatewayManagementApi({
  endpoint: process.env.APIG_ENDPOINT,
});

exports.send = async (recipients, data) => {
  const promises = recipients.map(async (connection) => {
    try {
      await apig
        .postToConnection({
          ConnectionId: connection.connectionId,
          Data: JSON.stringify(data),
        })
        .promise();
    } catch (error) {
      if (error.statusCode === 410) {
        console.log("deleting stale connection", connection.connectionId);
        await connectionTableHandler.delete(connection.connectionId);
      }
    }
  });

  await Promise.all(promises);
};

exports.sendToConnection = async (connectionId, message) => {
  await apig
    .postToConnection({
      ConnectionId: connectionId,
      Data: message,
    })
    .promise();
};
