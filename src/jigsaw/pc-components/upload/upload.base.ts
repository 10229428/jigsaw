import {AbstractJigsawComponent} from "../../common/common";
import {ElementRef, EventEmitter, Input, OnDestroy, Optional, Output, Renderer2} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {TranslateService} from "@ngx-translate/core";
import {CommonUtils} from "../../common/core/utils/common-utils";

export type UploadFileInfo = {
    name: string, url: string, file: File, reason: string,
    state: 'pause' | 'loading' | 'success' | 'error'
};

export class JigsawUploadBase extends AbstractJigsawComponent implements OnDestroy {
    constructor(@Optional() protected _http: HttpClient,
                protected _renderer: Renderer2,
                protected _elementRef: ElementRef,
                @Optional() protected _translateService: TranslateService) {
        super();
    }

    @Input()
    public targetUrl: string = '/rdk/service/common/upload';

    @Input()
    public fileType: string;

    @Input()
    public multiple: boolean = true;

    @Input()
    public contentField: string = 'file';

    @Input()
    public fileNameField: string = 'filename';

    private _minSize: number;

    @Input()
    public get minSize(): number {
        return this._minSize;
    }

    public set minSize(value: number) {
        if (isNaN(value)) {
            console.error('minSize property must be a number, please input a number or number string');
            return;
        }
        this._minSize = Number(value);
    }

    private _maxSize: number;

    @Input()
    public get maxSize(): number {
        return this._maxSize;
    }

    public set maxSize(value: number) {
        if (isNaN(value)) {
            console.error('max property must be a number, please input a number or number string');
            return;
        }
        this._maxSize = Number(value);
    }

    @Output()
    public progress = new EventEmitter<UploadFileInfo>();

    @Output()
    public remove = new EventEmitter<UploadFileInfo>();

    @Output()
    public complete = new EventEmitter<UploadFileInfo[]>();

    @Output()
    public start = new EventEmitter<UploadFileInfo[]>();

    @Output()
    /**
     * @deprecated
     */
    public update = new EventEmitter<UploadFileInfo[]>();

    public _$uploadMode: 'select' | 'selectAndList' = 'select';

    protected _fileInputEl: Element;

    private _removeFileChangeEvent: Function;

    public _$validFiles: UploadFileInfo[] = [];

    public _$invalidFiles: UploadFileInfo[] = [];

    public get _$allFiles(): UploadFileInfo[] {
        return [...this._$validFiles, ...this._$invalidFiles];
    }

    /**
     * @internal
     */
    public _$selectFile($event) {
        $event.preventDefault();
        $event.stopPropagation();
        let e = document.createEvent("MouseEvent");
        e.initEvent("click", true, true);

        if (!this._fileInputEl) {
            this._fileInputEl = document.createElement('input');
            this._fileInputEl.setAttribute('type', 'file');
            if (CommonUtils.isIE()) {
                //指令模式动态创建的input不在dom中的时候，ie11无法监听click事件，此处将其加入body中，设置其不可见
                this._fileInputEl.setAttribute('display', 'none');
                document.body.appendChild(this._fileInputEl);
            }
        }
        if (this.multiple) {
            this._fileInputEl.setAttribute('multiple', 'true');
        } else {
            this._fileInputEl.removeAttribute('multiple');
        }
        this._fileInputEl.setAttribute('accept', this.fileType);

        this._removeFileChangeEvent = this._removeFileChangeEvent ? this._removeFileChangeEvent :
            this._renderer.listen(this._fileInputEl, 'change', () => {
                this._upload();
            });

        this._fileInputEl.dispatchEvent(e);
    }

    protected _upload(files?: FileList) {
        if (!files) {
            const fileInput = this._fileInputEl;
            files = fileInput['files'];
        }

        if (!files || !files.length) {
            console.warn('there are no upload files');
            return;
        }

        if (!this.multiple) {
            this._$validFiles = [];
            this._$invalidFiles = [];
        }

        this._classifyFiles(Array.from(files));
        const pendingFiles = this._$validFiles.filter(file => file.state == 'pause');
        for (let i = 0, len = Math.min(5, pendingFiles.length); i < len; i++) {
            // 最多前5个文件同时上传给服务器
            this._sequenceUpload(pendingFiles[i]);
        }

        this._$uploadMode = 'selectAndList';
        if (pendingFiles.length > 0) {
            this.start.emit(this._$validFiles);
        }

        if (this._fileInputEl) {
            this._fileInputEl['value'] = null;
        }
    }

    private _testFileType(fileName: string, type: string): boolean {
        const re = new RegExp(`.+\\${type.trim()}$`, 'i');
        return re.test(fileName);
    }

    private _classifyFiles(files: File[]): void {
        if (this.fileType) {
            const fileTypes = this.fileType.split(',');
            const oldFiles = files;
            files = files.filter(f => !!fileTypes.find(ft => this._testFileType(f.name, ft)));
            oldFiles.filter(f => files.indexOf(f) == -1).forEach(file => {
                this._$invalidFiles.push({
                    name: file.name, state: 'error', url: '', file: file,
                    reason: this._translateService.instant(`upload.fileTypeError`)
                })
            });
        }

        if (this.minSize) {
            const oldFiles = files;
            files = files.filter(f => f.size >= this.minSize * 1024 * 1024);
            oldFiles.filter(f => files.indexOf(f) == -1).forEach(file => {
                this._$invalidFiles.push({
                    name: file.name, state: 'error', url: '', file: file,
                    reason: this._translateService.instant(`upload.fileMinSizeError`)
                })
            });
        }

        if (this.maxSize) {
            const oldFiles = files;
            files = files.filter(f => f.size <= this.maxSize * 1024 * 1024);
            oldFiles.filter(f => files.indexOf(f) == -1).forEach(file => {
                this._$invalidFiles.push({
                    name: file.name, state: 'error', url: '', file: file,
                    reason: this._translateService.instant(`upload.fileMaxSizeError`)
                })
            });
        }

        files.forEach((file: File) => {
            this._$validFiles.push({
                name: file.name, state: 'pause', url: '', file: file, reason:  ''
            });
        });
    }

    private _isAllFilesUploaded(): boolean {
        return !this._$validFiles.find(f => f.state == 'loading' || f.state == 'pause');
    }

    private _sequenceUpload(fileInfo: UploadFileInfo) {
        fileInfo.state = 'loading';
        const formData = new FormData();
        formData.append(this.contentField, fileInfo.file);
        const fileNameField = this.fileNameField ? this.fileNameField.trim() : '';
        if (fileNameField) {
            formData.append(fileNameField, encodeURI(fileInfo.file.name));
        }
        if (!this._http) {
            console.error('Jigsaw upload pc-components must inject HttpClientModule, please import it to the module!');
            return;
        }
        this._http.post(this.targetUrl, formData, {responseType: 'text'}).subscribe(res => {
            fileInfo.state = 'success';
            fileInfo.url = res;
            fileInfo.reason = '';
            this._afterCurFileUploaded(fileInfo);
        }, (e) => {
            fileInfo.state = 'error';
            fileInfo.reason = this._translateService.instant(`upload.${e.statusText}`);
            this._afterCurFileUploaded(fileInfo);
        });
    }

    private _afterCurFileUploaded(fileInfo: UploadFileInfo) {
        this.progress.emit(fileInfo);

        const waitingFile = this._$validFiles.find(f => f.state == 'pause');
        if (waitingFile) {
            this._sequenceUpload(waitingFile)
        } else if (this._isAllFilesUploaded()) {
            this.complete.emit(this._$validFiles);
            this.update.emit(this._$validFiles)
        }
    }

    public _$removeFile(file) {
        this.remove.emit(file);
        let fileIndex = this._$validFiles.findIndex(f => f == file);
        if (fileIndex != -1) {
            this._$validFiles.splice(fileIndex, 1);
            // 保持向下兼容
            if (this._isAllFilesUploaded()) {
                this.update.emit(this._$validFiles);
            }
        }
        fileIndex = this._$invalidFiles.findIndex(f => f == file);
        if (fileIndex != -1) {
            this._$invalidFiles.splice(fileIndex, 1);
        }
        if (this._fileInputEl) {
            this._fileInputEl['value'] = null;
        }
    }

    public clearFileList() {
        this._$validFiles = [];
        this._$invalidFiles = [];
    }

    ngOnDestroy() {
        super.ngOnDestroy();
        if (this._removeFileChangeEvent) {
            this._removeFileChangeEvent();
            this._removeFileChangeEvent = null;
        }

        this._fileInputEl = null;
    }
}
