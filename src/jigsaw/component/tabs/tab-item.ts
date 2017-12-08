import {
    Component, Input, ViewContainerRef, TemplateRef, ViewChild, ElementRef,
    AfterViewInit, EmbeddedViewRef, ChangeDetectorRef, Type, ComponentFactoryResolver,
    ComponentRef, OnDestroy
} from '@angular/core';
import {AbstractJigsawComponent, IDynamicInstantiatable} from "../common";


export abstract class JigsawTabBase extends AbstractJigsawComponent implements OnDestroy {

    constructor(protected _changeDetector: ChangeDetectorRef, protected _componentFactory: ComponentFactoryResolver) {
        super()
    }

    @Input()
    public key: number;

    @Input()
    public tabItem: TemplateRef<any> | Type<IDynamicInstantiatable>;

    @Input()
    public initData: Object;

    @ViewChild('body', {read: ViewContainerRef})
    protected _body: ViewContainerRef;

    protected _tabItemRef: EmbeddedViewRef<any> | ComponentRef<IDynamicInstantiatable>;

    protected _insert(): void {
        if (!this._tabItemRef) {
            this._tabItemRef = this._createTab(this.tabItem, this.initData);
            this._changeDetector.detectChanges()
        }
    }

    protected _destroy(): void {
        if (this._tabItemRef) {
            this._tabItemRef.destroy();
            this._tabItemRef = null
        }
    }

    protected _createTab(what: Type<IDynamicInstantiatable> | TemplateRef<any>,
                         initData: Object): EmbeddedViewRef<any> | ComponentRef<IDynamicInstantiatable> {
        if (what instanceof TemplateRef) {
            return this._body.createEmbeddedView(what, initData);
        } else if (what) {
            const factory = this._componentFactory.resolveComponentFactory(what);
            const componentRef = this._body.createComponent(factory);
            componentRef.instance.initData = initData;
            return componentRef;
        }
    }

    ngOnDestroy() {
        this._destroy()
    }
}

/**
 * @internal
 */
@Component({
    selector: 'jigsaw-tab-label',
    template: `
        <ng-template #body></ng-template>
    `
})
export class JigsawTabLabel extends JigsawTabBase implements AfterViewInit {

    constructor(public elementRef: ElementRef,
                protected _changeDetector: ChangeDetectorRef,
                protected _componentFactory: ComponentFactoryResolver) {
        super(_changeDetector, _componentFactory)
    }

    // label 左侧的距离
    public getOffsetLeft(): number {
        return this.elementRef.nativeElement.offsetLeft;
    }

    public getOffsetTop(): number {
        return this.elementRef.nativeElement.offsetTop;
    }

    // 组件的宽度
    public getOffsetWidth(): number {
        return this.elementRef.nativeElement.offsetWidth;
    }

    ngAfterViewInit() {
        this._insert()
    }

}

/**
 * @internal
 */
@Component({
    selector: 'jigsaw-tab-content',
    host: {
        '[class.jigsaw-tabs-tabpane]': 'true',
        '[class.jigsaw-tabs-tabpane-active]': 'isActive',
        '[class.jigsaw-tabs-tabpane-inactive]': '!isActive'
    },
    template: `
        <ng-template #body></ng-template>
    `
})
export class JigsawTabContent extends JigsawTabBase implements AfterViewInit {

    constructor(protected _changeDetector: ChangeDetectorRef, protected _componentFactory: ComponentFactoryResolver) {
        super(_changeDetector, _componentFactory)
    }

    @Input()
    public async: boolean;

    private _isActive: boolean;

    @Input()
    public get isActive(): boolean {
        return this._isActive;
    }

    public set isActive(active: boolean) {
        this._isActive = active;
        if (this.initialized && this.async) {
            if (active) {
                this._insert();
            } else {
                this._destroy();
            }
        }
    }

    ngAfterViewInit() {
        if (!this.async || this._isActive) {
            this._insert();
        }
    }

}
