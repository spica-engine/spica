import {Subject} from "rxjs";
import {StorageService} from "@spica-server/storage";
import {StorageObject, StorageObjectMeta} from "@spica-server/interface-storage";

describe("Storage Service insert", () => {
  const object = (name: string): StorageObject<Buffer> => ({
    name,
    url: `http://insteadof/${name}`,
    content: {data: Buffer.from(name), type: "text/plain", size: name.length}
  });

  const stored = (name: string, id: string): StorageObjectMeta => ({
    _id: id,
    name,
    url: `http://insteadof/${name}`,
    content: {type: "text/plain", size: name.length}
  });

  function serviceWith(insertAll: jest.Mock) {
    const strategy = {
      write: jest.fn(async (..._: any[]) => undefined),
      delete: jest.fn(),
      resumableUploadFinished: new Subject()
    };
    const objects = {insertAll, deleteByIds: jest.fn()};
    const service = new StorageService(objects as any, strategy as any, {} as any, {} as any);
    return {service, strategy, objects};
  }

  it("should write every file under the name of the record that was stored for it", async () => {
    const reordered = jest.fn(async () => [stored("b", "2"), stored("a", "1")]);
    const {service, strategy} = serviceWith(reordered);

    const inserted = await service.insert([object("a"), object("b")]);

    expect(strategy.write.mock.calls.map(call => [call[0], call[1].toString()])).toEqual([
      ["a", "a"],
      ["b", "b"]
    ]);
    expect(inserted.map(record => record.name)).toEqual(["a", "b"]);
  });

  it("should remove the stored records when a file can not be written", async () => {
    const {service, strategy, objects} = serviceWith(
      jest.fn(async () => [stored("b", "2"), stored("a", "1")])
    );
    strategy.write.mockImplementation(async (name: string) => {
      if (name == "b") {
        throw new Error("disk full");
      }
    });

    await expect(service.insert([object("a"), object("b")])).rejects.toThrow("disk full");

    expect(objects.deleteByIds).toHaveBeenCalledWith(["1", "2"]);
  });
});
