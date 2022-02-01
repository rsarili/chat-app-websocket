const AWS = require("aws-sdk");
const apig = new AWS.ApiGatewayManagementApi({
  endpoint: process.env.APIG_ENDPOINT,
});

const userTableHandler = require("./user-table-handler");
const connectionTableHandler = require("./connection-table-handler");

const connectionHandler = async (event, context) => {
  console.log(JSON.stringify(event));

  const {
    body,
    requestContext: { connectionId, routeKey },
  } = event;

  switch (routeKey) {
    case "$connect":
      const username = event.queryStringParameters.username;
      if (username.includes(" ")) {
        return { statusCode: 500 };
      }

      await userTableHandler.update(username);
      await connectionTableHandler.put(connectionId, username);

      break;

    case "$disconnect":
      await connectionTableHandler.delete(connectionId);
      break;

    case "message": {
      const body = JSON.parse(event.body);

      const recipients = (
        await connectionTableHandler.getByUsername(body.data.to)
      ).Items;
      const sender = (await connectionTableHandler.get(connectionId)).Item;

      await sendFromUser(sender, recipients, body.data.message);

      break;
    }

    case "broadcast": {
      const recipients = (await connectionTableHandler.scan()).Items;
      const sender = (await connectionTableHandler.get(connectionId)).Item;
      const body = JSON.parse(event.body);

      await sendFromUser(sender, recipients, body.data.message);

      break;
    }

    case "getOnlineUsers": {
      const recipients = (
        await connectionTableHandler.getByUsername(body.data.to)
      ).Items;

      const onlineUsers = (await connectionTableHandler.scan()).Items;
      const uniqueOnlineUsers = new Set();
      onlineUsers.forEach((user) => {
        uniqueOnlineUsers.add(user.username);
      });

      await sendFromServer(recipients, { users: [...uniqueOnlineUsers] });
      break;
    }

    case "$default":
    default:
      await apig
        .postToConnection({
          ConnectionId: connectionId,
          Data: `Received on $default: ${body}`,
        })
        .promise();
  }

  return { statusCode: 200 };
};

const sendFromServer = async (recipients, message) => {
  await send(recipients, { message: message });
};

const sendFromUser = async (sender, recipients, message) => {
  await send(recipients, { from: sender.username, message: message });
};

const send = async (recipients, data) => {
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

module.exports = {
  connectionHandler,
};
