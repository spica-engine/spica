import axios from "axios";

export class RequestService {
  request(options: any) {
    return axios(options)
      .then(res => res.data)
      .catch(error =>
        Promise.reject(
          error.response
            ? typeof error.response.data == "object"
              ? JSON.stringify(error.response.data)
              : error.response.data || error.response.statusText
            : error.toString()
        )
      );
  }
}
