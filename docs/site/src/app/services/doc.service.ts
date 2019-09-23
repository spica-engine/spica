import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";

@Injectable({
  providedIn: "root"
})
export class DocService {
  constructor(private http: HttpClient) {}

  getApiDocs() {
    return this.http.get("/assets/docs/api/doc-list.json");
  }

  getApiDocList(name: string) {
    return this.http.get(`/assets/docs/api/${name}/doc-list.json`);
  }

  getApiDoc(name: string, docName: string) {
    return this.http.get(`/assets/docs/api/${name}/${docName}.html`, {responseType: "text"});
  }

  getContentDocs() {
    return this.http.get<any>("/assets/docs/doc-list.json");
  }

  getContentDoc(name: string, docName: string) {
    return this.http.get(`/assets/docs/${name}/${docName}.html`, {responseType: "text"});
  }
}
