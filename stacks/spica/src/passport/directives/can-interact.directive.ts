import {
  Directive,
  HostBinding,
  Input,
  OnInit,
  SimpleChanges,
  ElementRef,
  Renderer2,
  HostListener,
  Output,
  EventEmitter
} from "@angular/core";
import {PassportService} from "../services/passport.service";

@Directive({selector: "[canInteract]"})
export class CanInteractDirectiveTest {
  @Input("canInteract") action: string;
  @Input("resource") resource: string;
}

@Directive({selector: "[canInteract]"})
export class CanInteractDirective implements OnInit {
  @HostBinding("disabled") isDisabled: boolean | undefined;
  @Input("canInteract") action: string;
  @Input() resource: string;

  @Output() click: EventEmitter<unknown> = new EventEmitter();

  tooltipTitle: string = "";
  placement: string = "bottom";
  delay: number = 200;
  tooltip: HTMLElement;
  offset = 10;

  allowed = true;

  isInitialized = false;

  constructor(
    private passport: PassportService,
    private elementRef: ElementRef<HTMLElement>,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    this.setVisible(this.action, this.resource);
  }

  ngOnDestroy() {
    this.mouseLeave();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      Object.keys(changes)
        .map(key => changes[key].firstChange)
        .some(firstChange => firstChange == false)
    ) {
      this.setVisible(
        changes.action ? changes.action.currentValue : this.action,
        changes.resource ? changes.resource.currentValue : this.resource
      );
    }
  }

  setVisible(action: string, resource: string) {
    this.passport
      .checkAllowed(action, resource)
      .toPromise()
      .then(allowed => {
        this.allowed = allowed;
        this.tooltipTitle = `${this.action} is missing.`;

        if (!this.allowed) {
          this.renderer.addClass(this.elementRef.nativeElement, "ng-disabled-button");
        }
      });
  }

  mouseEnter = (hostPos: DOMRect) => {
    return () => {
      // clear tooltips which may added before
      if (this.tooltip) {
        this.renderer.removeClass(this.tooltip, "ng-tooltip-show");
        this.renderer.removeChild(document.body, this.tooltip);
        this.tooltip = null;
      }

      this.create();

      // SET POSITION
      this.setPosition(hostPos);

      // START
      this.renderer.addClass(this.tooltip, "ng-tooltip-show");
    };
  };

  mouseLeave = () => {
    if (this.tooltip) {
      this.renderer.removeClass(this.tooltip, "ng-tooltip-show");

      setTimeout(() => {
        if (this.tooltip) {
          this.renderer.removeChild(document.body, this.tooltip);
        }
        this.tooltip = null;
      }, this.delay);
    }
  };

  @HostListener("mouseenter") onMouseEnter() {
    if (!this.allowed) {
      this.renderer.addClass(this.elementRef.nativeElement, "ng-disabled-button");

      // we have to clear all click listeners of this element.
      const elementWithoutListeners = this.elementRef.nativeElement.cloneNode(true);

      // calculate hostposition before add event listener;
      const hostPos = this.elementRef.nativeElement.getBoundingClientRect();

      elementWithoutListeners.addEventListener("mouseenter", this.mouseEnter(hostPos));
      elementWithoutListeners.addEventListener("mouseleave", this.mouseLeave);

      this.elementRef.nativeElement.replaceWith(elementWithoutListeners);
    }
  }

  create() {
    this.tooltip = this.renderer.createElement("span");

    this.renderer.appendChild(
      this.tooltip,
      this.renderer.createText(this.tooltipTitle) // textNode
    );

    this.renderer.appendChild(document.body, this.tooltip);
    // this.renderer.appendChild(this.elementRef.nativeElement, this.tooltip);

    this.renderer.addClass(this.tooltip, "ng-tooltip");
    this.renderer.addClass(this.tooltip, "ng-tooltip-bottom");

    // delay 설정
    this.renderer.setStyle(this.tooltip, "-webkit-transition", `opacity ${this.delay}ms`);
    this.renderer.setStyle(this.tooltip, "-moz-transition", `opacity ${this.delay}ms`);
    this.renderer.setStyle(this.tooltip, "-o-transition", `opacity ${this.delay}ms`);
    this.renderer.setStyle(this.tooltip, "transition", `opacity ${this.delay}ms`);
  }

  setPosition(hostPos: DOMRect) {
    const tooltipPos = this.tooltip.getBoundingClientRect();

    const scrollPos =
      window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

    let top: number, left: number;

    if (this.placement === "top") {
      top = hostPos.top - tooltipPos.height - this.offset;
      left = hostPos.left + (hostPos.width - tooltipPos.width) / 2;
    }

    if (this.placement === "bottom") {
      top = hostPos.bottom + this.offset;
      left = hostPos.left + (hostPos.width - tooltipPos.width) / 2;
    }

    if (this.placement === "left") {
      top = hostPos.top + (hostPos.height - tooltipPos.height) / 2;
      left = hostPos.left - tooltipPos.width - this.offset;
    }

    if (this.placement === "right") {
      top = hostPos.top + (hostPos.height - tooltipPos.height) / 2;
      left = hostPos.right + this.offset;
    }

    this.renderer.setStyle(this.tooltip, "top", `${top + scrollPos}px`);
    this.renderer.setStyle(this.tooltip, "left", `${left}px`);
  }
}
