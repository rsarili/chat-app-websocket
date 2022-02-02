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
    case "$connect": {
      const username = event.queryStringParameters.username;
      if (username.includes(" ")) {
        return { statusCode: 500 };
      }

      const notExist =
        (await connectionTableHandler.getByUsername(username)).Count === 0;
      if (notExist) {
        await broadcast({ action: "connected", user: username });
      }

      await userTableHandler.update(username);
      await connectionTableHandler.put(connectionId, username);

      break;
    }

    case "$disconnect": {
      const connection = (await connectionTableHandler.get(connectionId)).Item;
      const lastConnection =
        (await connectionTableHandler.getByUsername(connection.username))
          .Count === 1;
      if (lastConnection) {
        await broadcast({ action: "disconnected", user: connection.username });
      }

      await connectionTableHandler.delete(connectionId);

      break;
    }

    case "broadcast": {
      const recipients = (await connectionTableHandler.scan()).Items;
      const sender = (await connectionTableHandler.get(connectionId)).Item;
      const body = JSON.parse(event.body);

      await send(recipients, {
        action: "broadcast",
        data: { from: sender.username, message: body.data.message },
      });

      break;
    }

    case "getUsers": {
      const username = (await connectionTableHandler.get(connectionId)).Item
        .username;
      const recipients = (await connectionTableHandler.getByUsername(username))
        .Items;

      const onlineUsers = (await connectionTableHandler.scan()).Items;
      const uniqueOnlineUsers = new Set();
      onlineUsers.forEach((user) => {
        uniqueOnlineUsers.add(user.username);
      });

      await send(recipients, {
        action: "getUsers",
        data: { online: [...uniqueOnlineUsers] },
      });
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

const broadcast = async (message) => {
  const recipients = (await connectionTableHandler.scan()).Items;
  await send(recipients, message);
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
