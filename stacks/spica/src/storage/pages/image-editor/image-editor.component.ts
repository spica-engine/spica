import {Component, ElementRef, OnInit, ViewChild} from "@angular/core";
import {DomSanitizer} from "@angular/platform-browser";
import {ActivatedRoute, Router} from "@angular/router";
import {CropperComponent} from "angular-cropperjs";
import {filter, switchMap, take} from "rxjs/operators";
import {Storage} from "../../interfaces/storage";
import {StorageService} from "../../storage.service";
import {bufferToBase64} from "../../utils";

@Component({
  selector: "storage-image-editor",
  templateUrl: "./image-editor.component.html",
  styleUrls: ["./image-editor.component.scss"]
})
export class ImageEditorComponent implements OnInit {
  @ViewChild("cropperComponent", {static: false}) public cropperComponent: CropperComponent;
  @ViewChild("canvas", {static: true}) canvas: ElementRef;

  public cropperOptions: Cropper.Options = {
    movable: true,
    zoomable: true,
    checkCrossOrigin: true,
    viewMode: 2,
    toggleDragModeOnDblclick: true
  };

  public scale: number = 100;
  public base64File;
  public storage: Storage;

  public imageUrl: string = undefined;
  public resourceLoaded: boolean = false;

  private _cropperRes = {width: 0, height: 0};

  constructor(
    private activatedRoute: ActivatedRoute,
    private storageService: StorageService,
    private domSanitizer: DomSanitizer,
    private router: Router
  ) {}

  get cropperRes() {
    return {
      width: Math.round((this._cropperRes.width * this.scale) / 100) || undefined,
      height: Math.round((this._cropperRes.height * this.scale) / 100) || undefined
    };
  }

  set cropperRes(val) {
    this._cropperRes = val;
  }

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        take(1),
        filter(params => params.id),
        switchMap(params => this.storageService.getOne(params.id))
      )
      .subscribe(storage => {
        this.storage = storage;
        this.base64File = bufferToBase64(storage.content.data.data);
        this.imageUrl = this.domSanitizer.bypassSecurityTrustUrl(
          `data:${storage.content.type};base64,${this.base64File}`
        ) as string;
      });
  }

  cropperReady() {
    this.cropendImage();
  }

  cropendImage() {
    const {width, height} = this.cropperComponent.cropper.getData(true);
    this.cropperRes = {width, height};
  }

  zoom(status) {
    status = status === "positive" ? 0.1 : -0.1;
    this.cropperComponent.cropper.zoom(status);
    this.cropendImage();
  }

  zoomManual() {
    this.cropendImage();
  }

  rotate(turn) {
    turn = turn === "left" ? -45 : 45;
    this.cropperComponent.cropper.rotate(turn);
    this.cropendImage();
  }

  doneCropping() {
    this.scaleImage().toBlob(blob => {
      const file = new File([blob], this.storage.name, {type: blob.type});
      this.storageService
        .updateOne(this.storage._id, file)
        .toPromise()
        .then(() => {
          this.router.navigate(["storage"]);
        });
    });
  }

  private scaleImage(): HTMLCanvasElement {
    const context: CanvasRenderingContext2D = this.canvas.nativeElement.getContext("2d");
    this.canvas.nativeElement.width = this.cropperRes.width;
    this.canvas.nativeElement.height = this.cropperRes.height;
    const image = this.cropperComponent.cropper.getCroppedCanvas();
    context.drawImage(
      image,
      0,
      0,
      image.width,
      image.height,
      0,
      0,
      this.canvas.nativeElement.width,
      this.canvas.nativeElement.height
    );

    return context.canvas;
  }
}
