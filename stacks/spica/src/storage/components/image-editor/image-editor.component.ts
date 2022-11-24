import {Component, ElementRef, Inject, OnInit, ViewChild} from "@angular/core";
import {MatDialogRef, MAT_DIALOG_DATA} from "@angular/material/dialog";
import {CropperComponent} from "angular-cropperjs";
import {Storage} from "../../interfaces/storage";
import {StorageService} from "../../storage.service";
import {Observable, of, BehaviorSubject} from "rxjs";
import {SavingState} from "@spica-client/material";
import {tap, take} from "rxjs/operators";
import {HttpClient} from "@angular/common/http";
import {DomSanitizer, SafeUrl} from "@angular/platform-browser";

@Component({
  selector: "storage-image-editor",
  templateUrl: "./image-editor.component.html",
  styleUrls: ["./image-editor.component.scss"]
})
export class ImageEditorComponent implements OnInit {
  @ViewChild("cropperComponent") public cropperComponent: CropperComponent;
  @ViewChild("canvas", {static: true}) canvas: ElementRef;

  content: SafeUrl;

  public cropperOptions: Cropper.Options = {
    movable: true,
    zoomable: true,
    checkCrossOrigin: true,
    viewMode: 2,
    toggleDragModeOnDblclick: true
  };

  public scale: number = 100;
  public storage: Storage;

  public resourceLoaded: boolean = false;

  private _cropperRes = {width: 0, height: 0};

  $save: BehaviorSubject<SavingState> = new BehaviorSubject(SavingState.Pristine);

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private storageService: StorageService,
    private dialogRef: MatDialogRef<ImageEditorComponent>,
    @Inject(MAT_DIALOG_DATA) private data: Storage
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
    this.storageService
      .getOne(this.data._id)
      .pipe(tap(() => this.$save.next(SavingState.Pristine)))
      .toPromise()
      .then(storage => (this.storage = storage))
      .then(storage => this.storageService.download(storage.url))
      .then(content => (this.content = content));
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
    this.$save.next(SavingState.Saving);
    this.scaleImage().toBlob(blob => {
      const file = new File([blob], this.storage.name, {type: blob.type});
      this.storageService
        .updateOne(this.storage, file)
        .toPromise()
        .then(() => {
          this.dialogRef.close(this.storage._id);
          this.$save.next(SavingState.Saved);
        })
        .catch(() => this.$save.next(SavingState.Failed));
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
