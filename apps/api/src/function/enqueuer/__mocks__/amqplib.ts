const mockQueue = {
  name: "mockQueue"
};

const createMockChannel = () => {
  const mockChannel = {
    assertQueue: jest.fn(() => Promise.resolve(mockQueue)),
    consume: jest.fn((queue, onMessage) => {
      process.nextTick(() => {
        onMessage({content: Buffer.from("Hello World!")});
        onMessage({content: Buffer.from("Message")});
      });
    }),
    close: jest.fn(),
    sendToQueue: jest.fn(),
    on: jest.fn(),
    assertExchange: jest.fn(() => Promise.resolve()),
    bindQueue: jest.fn(() => Promise.resolve()),
    publish: jest.fn(() => Promise.resolve())
  };

  Object.defineProperty(mockChannel, "target", {
    value: undefined,
    writable: true,
    configurable: true
  });

  return mockChannel;
};

const createMockConnection = () => {
  const mockConnection = {
    createChannel: jest.fn(() => Promise.resolve(createMockChannel())),
    close: jest.fn()
  };

  Object.defineProperty(mockConnection, "target", {
    value: undefined,
    writable: true,
    configurable: true
  });

  return mockConnection;
};

const amqplibMock = {
  connect: jest.fn(() => Promise.resolve(createMockConnection()))
};

export default amqplibMock;
