export default jest.fn(() =>
  Promise.resolve({
    headers: {
      raw: () => {
        return {key: ["value"]};
      }
    },
    status: 404,
    statusText: "Not Found",
    text: () => Promise.resolve("res_body")
  })
);
