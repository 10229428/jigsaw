import { Component} from "@angular/core";

@Component({
  templateUrl: 'basic.html'
})
export class TileselectBasicDemoComponent{

    citys = [
        {label: "北京"},
        {label: "上海"},
        {label: "南京"},
        {label: "深圳"},
        {label: "长沙"},
        {label: "西安"}
    ];
    constructor(){

    }

}

