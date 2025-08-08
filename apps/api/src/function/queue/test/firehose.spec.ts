import {EventQueue, FirehoseQueue} from "..";
import {Firehose} from "../proto";
import {credentials} from "@grpc/grpc-js";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:8594";

describe("FirehoseQueue", () => {
  let queue: EventQueue;
  let firehoseQueue: FirehoseQueue;
  let firehoseQueueClient: any;

  beforeAll(() => {
    queue = new EventQueue(
      () => {},
      () => {},
      () => {},
      () => {}
    );
    firehoseQueue = new FirehoseQueue();
    queue.addQueue(firehoseQueue as any);
    queue.listen();
    firehoseQueueClient = new Firehose.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      credentials.createInsecure()
    );
  });

  afterEach(() => {
    firehoseQueue["sockets"].clear();
  });

  afterAll(() => {
    queue.kill();
  });

  describe("pop", () => {
    it("should return error for nonexistent events", done => {
      const pop = new Firehose.Message.Pop({
        id: "1"
      });
      firehoseQueueClient.pop(pop, (e, req) => {
        expect(e).not.toBeUndefined();
        expect(e.message).toBe("2 UNKNOWN: Queue has no item with id 1");
        expect(req).toBeUndefined();
        expect(firehoseQueue.size).toEqual(0);
        done();
      });
    });

    it("should pop", done => {
      const pop = new Firehose.Message.Pop({
        id: "2"
      });
      firehoseQueue.enqueue(pop.id, new Firehose.Message.Incoming());
      expect(firehoseQueue.size).toEqual(1);

      firehoseQueueClient.pop(pop, (e, req) => {
        expect(e).toBe(null);
        expect(req instanceof Firehose.Message.Incoming).toBe(true);

        expect(firehoseQueue.size).toEqual(0);

        done();
      });
    });
  });

  it("should send message to socket", done => {
    const socket: any = {
      send: jest.fn(),
      readyState: 1
    };

    const client = new Firehose.ClientDescription({id: "1"});

    const incomingMessage = new Firehose.Message.Incoming({
      client,
      message: new Firehose.Message({name: "connection"})
    });

    firehoseQueue.enqueue("1", incomingMessage);
    firehoseQueue.setSocket(incomingMessage, socket);

    expect(firehoseQueue["sockets"].size).toEqual(1);

    const outgoingMessage = new Firehose.Message.Outgoing({
      client,
      message: new Firehose.Message({name: "test"})
    });

    firehoseQueueClient.send(outgoingMessage, (e, req) => {
      expect(e).toBe(null);
      expect(req instanceof Firehose.Message.Result).toBe(true);
      expect(socket.send).toHaveBeenCalledTimes(1);
      expect(socket.send).toHaveBeenCalledWith(`{"name":"test"}`);
      done();
    });
  });

  it("should send message to all OPEN sockets", done => {
    const firstSocket: any = {
      send: jest.fn(),
      readyState: 1
    };

    const secondSocket: any = {
      send: jest.fn(),
      readyState: 2
    };

    const firstMessage = new Firehose.Message.Incoming({
      client: new Firehose.ClientDescription({id: "1"}),
      message: new Firehose.Message({name: "connection"})
    });

    const secondMessage = new Firehose.Message.Incoming({
      client: new Firehose.ClientDescription({id: "2"}),
      message: new Firehose.Message({name: "connection"})
    });

    firehoseQueue.enqueue("1", firstMessage);
    firehoseQueue.setSocket(firstMessage, firstSocket);

    firehoseQueue.enqueue("2", secondMessage);
    firehoseQueue.setSocket(secondMessage, secondSocket);

    firehoseQueueClient.sendAll(
      new Firehose.Message({
        name: "test",
        data: JSON.stringify("data")
      }),
      (e, req) => {
        expect(e).toBe(null);
        expect(req instanceof Firehose.Message.Result).toBe(true);
        expect(firstSocket.send).toHaveBeenCalledTimes(1);
        expect(firstSocket.send).toHaveBeenCalledWith(`{"name":"test","data":"data"}`);
        expect(secondSocket.send).not.toHaveBeenCalled();
        done();
      }
    );
  });

  it("should close socket", done => {
    const socket: any = {
      close: jest.fn(),
      readyState: 1
    };

    const client = new Firehose.ClientDescription({id: "1"});

    const incomingMessage = new Firehose.Message.Incoming({
      client,
      message: new Firehose.Message({name: "connection"})
    });

    firehoseQueue.enqueue("1", incomingMessage);
    firehoseQueue.setSocket(incomingMessage, socket);

    firehoseQueueClient.close(new Firehose.Close({client}), (e, req) => {
      expect(e).toBe(null);
      expect(req instanceof Firehose.Close.Result).toBe(true);
      expect(socket.close).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it("should remove socket for close message", done => {
    const socket: any = {
      send: jest.fn(),
      readyState: 1
    };

    const client = new Firehose.ClientDescription({id: "1"});

    const connectionMessage = new Firehose.Message.Incoming({
      client,
      message: new Firehose.Message({name: "connection"})
    });

    const closeMessage = new Firehose.Message.Incoming({
      client,
      message: new Firehose.Message({name: "close"})
    });

    firehoseQueue.enqueue("1", connectionMessage);
    firehoseQueue.setSocket(connectionMessage, socket);

    expect(firehoseQueue["sockets"].size).toEqual(1);

    firehoseQueue.enqueue("2", closeMessage);
    firehoseQueue.removeSocket(closeMessage);

    expect(firehoseQueue["sockets"].size).toEqual(0);

    firehoseQueueClient.pop(new Firehose.Message.Pop({id: "2"}), done);
  });
});
