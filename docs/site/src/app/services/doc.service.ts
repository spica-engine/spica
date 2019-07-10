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

  getContentDocs() {
    return this.http.get("/assets/docs/content/doc-list.json");
  }
}
