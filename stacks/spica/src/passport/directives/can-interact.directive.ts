import {
  Directive,
  Input,
  OnInit,
  SimpleChanges,
  ElementRef,
  Renderer2,
  HostListener
} from "@angular/core";
import {PassportService} from "../services/passport.service";

@Directive({selector: "[canInteract]"})
export class CanInteractDirective implements OnInit {
  @Input("canInteract") action: string;
  @Input() resource: string;

  delay: number = 200;
  tooltip: HTMLElement;

  constructor(
    private passport: PassportService,
    private elementRef: ElementRef<HTMLElement>,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    this.setEnableState(this.action, this.resource);
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
      this.setEnableState(
        changes.action ? changes.action.currentValue : this.action,
        changes.resource ? changes.resource.currentValue : this.resource
      );
    }
  }

  setEnableState(action: string, resource: string) {
    this.passport
      .checkAllowed(action, resource)
      .toPromise()
      .then(allowed => {
        if (!allowed) {
          this.renderer.addClass(this.elementRef.nativeElement, "ng-disabled-button");

          // we have to clear all click listeners of this element which added from another directive
          const updatedNode = this.elementRef.nativeElement.cloneNode(true);

          const tooltipText = `'${action}' is required for this action.`;

          updatedNode.addEventListener("mouseenter", this.mouseEnter(tooltipText));
          updatedNode.addEventListener("mouseleave", this.mouseLeave);

          this.elementRef.nativeElement.replaceWith(updatedNode);
        }
      });
  }

  mouseEnter = (text: string) => {
    return (event: MouseEvent) => {
      this.create(text);

      const elementPosition = (event.target as HTMLElement).getBoundingClientRect();
      this.setPosition(elementPosition);

      this.renderer.addClass(this.tooltip, "ng-tooltip-show");
    };
  };

  mouseLeave = () => {
    if (this.tooltip) {
      this.renderer.removeClass(this.tooltip, "ng-tooltip-show");
      setTimeout(() => {
        // somehow, we need this if block
        if (this.tooltip) {
          this.renderer.removeChild(document.body, this.tooltip);
          this.tooltip = null;
        }
      }, this.delay);
    }
  };

  create = (text: string) => {
    this.tooltip = this.renderer.createElement("span");

    this.renderer.appendChild(this.tooltip, this.renderer.createText(text));

    // TODO: merge this classes
    this.renderer.addClass(this.tooltip, "ng-tooltip");
    this.renderer.addClass(this.tooltip, "ng-tooltip-bottom");

    this.renderer.setStyle(this.tooltip, "-webkit-transition", `opacity ${this.delay}ms`);
    this.renderer.setStyle(this.tooltip, "-moz-transition", `opacity ${this.delay}ms`);
    this.renderer.setStyle(this.tooltip, "-o-transition", `opacity ${this.delay}ms`);
    this.renderer.setStyle(this.tooltip, "transition", `opacity ${this.delay}ms`);

    this.renderer.appendChild(document.body, this.tooltip);
  };

  setPosition = (elementPosition: DOMRect) => {
    const tooltipPosition = this.tooltip.getBoundingClientRect();

    const border = document.body.getBoundingClientRect();

    let top: number, left: number;

    // tooltip bottom must be less than border bottom
    top = Math.min(elementPosition.bottom, border.bottom - tooltipPosition.height);

    // tooltip left must be positive
    left = Math.max(elementPosition.left + (elementPosition.width - tooltipPosition.width) / 2, 0);

    // tooltip right must be less than border right
    left = left - Math.max(left + tooltipPosition.width - border.right, 0);

    this.renderer.setStyle(this.tooltip, "top", `${top}px`);
    this.renderer.setStyle(this.tooltip, "left", `${left}px`);
  };
}
