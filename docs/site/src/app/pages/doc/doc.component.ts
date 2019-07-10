import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-doc',
  templateUrl: './doc.component.html',
  styleUrls: ['./doc.component.css']
})
export class DocComponent implements OnInit {

  $docs: Observable<any>;

  constructor(private http: HttpClient) { 
    this.$docs = http.get('/assets/docs/doc-list.json');
  }

  ngOnInit() {
  }

}
