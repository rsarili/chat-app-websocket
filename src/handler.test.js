jest.mock("./gw-handler");
jest.mock("./connection-table-handler");
jest.mock("./user-table-handler");

const gwHandler = require("./gw-handler");
const connectionTableHandler = require("./connection-table-handler");
const userTableHandler = require("./user-table-handler");

const handler = require("./handler");

describe("handler test", () => {
  test("should close connect if user name has spaces", async () => {
    const result = await handler.connectionHandler({
      queryStringParameters: { username: "john doe" },
      requestContext: { routeKey: "$connect", connectionId: "conn" },
    });
    expect(result).toEqual({ statusCode: 500 });
  });

  test("should broadcast info for new incoming user", async () => {
    connectionTableHandler.getByUsername.mockResolvedValueOnce({ Count: 0 });
    const items = [
      { connectionId: "c1", username: "u1" },
      { connectionId: "c2", username: "u2" },
    ];
    connectionTableHandler.scan.mockResolvedValueOnce({ Items: items });

    const result = await handler.connectionHandler({
      queryStringParameters: { username: "john" },
      requestContext: { routeKey: "$connect", connectionId: "conn" },
    });

    expect(result).toEqual({ statusCode: 200 });
    expect(gwHandler.send).toHaveBeenCalledWith(items, {
      action: "connected",
      data: { user: "john" },
    });
  });

  test("should save incoming connection", async () => {
    connectionTableHandler.getByUsername.mockResolvedValueOnce({ Count: 1 });

    const result = await handler.connectionHandler({
      queryStringParameters: { username: "john" },
      requestContext: { routeKey: "$connect", connectionId: "conn" },
    });

    expect(result).toEqual({ statusCode: 200 });
    expect(userTableHandler.update).toHaveBeenCalledWith("john");
    expect(connectionTableHandler.put).toHaveBeenCalledWith("conn", "john");
  });
});
