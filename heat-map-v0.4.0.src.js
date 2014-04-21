(function($) {
var initcolor = "#ffffff";

$.fn.heatmap = function() {
    var args = arguments,
        options = merge(args[0]),
        region = args[1],
        heatmap;
    heatmap = new Heatmap(this[0], options, region);
    return heatmap;
};

var defaultOptions = {
    map:{
        plate:{
            "stroke":"#dddddd",
            "stroke-width": 1,
            "stroke-linejoin":"round"
        },
        txt:{
            "size":9,
            "font-family":"",
            "font-weight":"",
            "fill":"#333"
        },
        select:{
            "stroke":"orange",
            "stroke-width": 2,
            "stroke-linejoin":"round"
        },
        mouseover: null,
        mouseout: null,
        click: null,
        shadow: "#555"
    },
    legend:{
        on:{
            "fill":"#274b6d",
            "text-anchor":"start",
            "font-size":9,
            "cursor":""
        },
        off:{
            "fill":"#ccc",
            "text-anchor":"start",
            "cursor":"pointer",
            "font-size":9,
        },
        wall:{
            "fill":"#fff",
            "stroke":"#ccc",
            "stroke-width": 1
        },
        show: null
    },
    ruler:{
        share: {
            "enable": false,
            "fill": "",
            "format": format
        },
        txt: {
            "font-size": 9,
            "fill": "#000"
        },
        setp: 10,
        "align": "right",
        "v-align": "top"
    },
    wall: {
        stroke:"none",
        fill:"rgba(255,255,255,0)"
    },
    animate: {
        "roll-sec": 0
    },
    
};

function Heatmap() {
    this.first.apply(this, arguments);
}
Heatmap.prototype = {
    first: function(container, options, region) {
        var hm = this;
        hm.container = container.id;
        hm.ow = $(container).width();
        hm.oh = $(container).height();
        hm.region = region;
        hm.data = options.data;
        options.data = null;
        hm.options = merge(defaultOptions, options);
        hm.paper = Raphael(hm.container, hm.ow, hm.oh);
        
        hm.init();
        hm.wall = new Wall(hm);
        hm.legend = new Legend(hm);
        hm.ruler = new Ruler(hm);
        hm.map = new Map(hm);
        
        hm.show();
        hm.animate();
    },
    redraw: function(arg, region) {
        var hm = this;
        hm.ow = $("#"+hm.container).width();
        hm.oh = $("#"+hm.container).height();
        if (arg) {
            var options = merge(arg)
            hm.data = options.data;
            options.data = null;
            hm.options = merge(defaultOptions, options);
            if (region) {
                hm.region = region;
            }
        }
        hm.paper.setSize(hm.ow, hm.oh);
        
        hm.init();
        hm.wall.init(hm);
        hm.legend.init(hm);
        hm.ruler.init(hm);
        hm.map.init(hm);
        hm.show();
        hm.animate();
    },
    init: function () {
        var hm = this,
            color = new Color();
    
        if (!hm.region || !heatMapResource[hm.region]) {
            return;
        }
        hm.mapdata = [];
        hm.mapgrade = [];
        hm.mapcolors = [];
        hm.legendconf = [];
        hm.grade = [];
        hm.colors = [];
        hm.sharegrade = [];
        hm.sharecolors = [];
        hm.isClickable = [];
        hm.selectedgrade = {};
        hm.selgradecounter = 0;
        
        var max = null,
            step = hm.options.ruler.step || 10,
            sharefill = null;
        if (hm.options.ruler.share.enable && hm.options.ruler.share.fill) {
            sharefill = hm.options.ruler.share.fill;
        }
        for (var i in hm.data) {
            var fill = sharefill || ((!hm.data[i].fill) ? color.pick() : hm.data[i].fill);
            
            var data = hm.makeMapData(i);
            if (!data) {
                continue;
            }
            var mm = minNmax(data);
            if (hm.options.ruler.share.enable) {
                if (!max || mm.max > max) {
                    hm.sharegrade = dataGrade(mm.min, mm.max, step);
                    max = mm.max;
                }
                if (hm.options.ruler.share.fill) {
                    if (hm.sharecolors.length === 0) {
                        hm.sharecolors = colorGrade(initcolor, hm.options.ruler.share.fill, step);
                    }
                } else {
                    hm.colors[i] = colorGrade(initcolor, fill, step);
                }
            } else {
                hm.grade[i] = dataGrade(mm.min, mm.max, step);
                hm.colors[i] = colorGrade(initcolor, fill, step);
            }
            hm.legendconf[i] = {fill: fill, txt: hm.data[i].title};
            hm.mapdata[i] = data;
            if (!hm.current) {
                hm.first = i;
                hm.current = i;
            }
        }
        for (var i in hm.mapdata) {
            hm.mapgrade[i] = [];
            hm.mapcolors[i] = [];
            for (var j in hm.mapdata[i]) {
                var grade = hm.grade[i] || hm.sharegrade;
                var color = hm.colors[i] || hm.sharecolors;
                var value = Math.round(hm.mapdata[i][j]);
                for (var g in grade) {
                    if (value <= grade[g]) {
                        var state = g;
                        break;
                    }
                }
                state = state || 0;
                hm.mapgrade[i][j] = state;
                hm.mapcolors[i][j] = color[state];
            }
        }
    },
    makeMapData: function(i) {
        var hm = this,
            tmp = {};
        hm.isClickable[i] = [];
        if (!hm.canBack) {
            for (var state in heatMapResource[hm.region].child) {
                if (typeof(hm.data[i]["data"][state]) === "object") {
                    tmp[state] = 0;
                    if (hm.data[i]["data"][state].total) {
                        tmp[state] = parseFloat(hm.data[i]["data"][state].total);
                    } else {
                        for (var j in hm.data[i]["data"][state]) {
                            if (heatMapResource[state] && heatMapResource[state]["child"][j]) {
                                tmp[state] += parseFloat(hm.data[i]["data"][state][j]);
                            }
                        }
                    }
                    if (tmp[state] > 0) {
                        hm.isClickable[i].push(state);
                    }
                } else {
                    tmp[state] = hm.data[i]["data"][state] > 0 ? parseFloat(hm.data[i]["data"][state]) : 0;
                }
            }
        } else {
            if (!hm.data[i]["data"][hm.region]) {
                return false;
            }
            for (var state in heatMapResource[hm.region].child) {
                tmp[state] = hm.data[i]["data"][hm.region][state] > 0 ? parseFloat(hm.data[i]["data"][hm.region][state]) : 0;
            }    
        }
        return tmp;
    },
    show: function(cur) {
        var hm = this;
        if (typeof(cur) === "undefined") {
            cur = hm.current;
        }
        if (cur >= hm.legendconf.length) {
            cur = hm.first;
        }
        if (!hm.mapdata[cur]) {
            return;
        }
        hm.current = cur;
        hm.legend.show(cur);
        hm.ruler.draw(cur);
        hm.map.fillColor(cur);
    },
    goin: function(region) {
        var hm = this;
        if (hm.canBack) {
            hm.region = hm.oregion;
            hm.canBack = false;
        } else if ($.inArray(region, hm.isClickable[this.current]) >= 0) {
            hm.oregion = hm.region;
            hm.region = region;
            hm.canBack = true;
        } else {
            return;
        }
        hm.redraw();
    },
    add: function() {
        var ag = arguments;
        var el = this.paper.add([ag[0]]);
        return el;
    },
    animate: function() {
        this.stopAnimate();
        if (!this.options.animate) {
            return;
        }
        var hm = this,
            sec = hm.options.animate["roll-sec"];
        if (typeof(sec) === "number" && sec > 0 && hm.legendconf.length > 1) {
            hm.animateRoll = setInterval(function(){
                hm.current++;
                hm.show(hm.current);
            }, sec*1000);
        }
    },
    stopAnimate: function() {
        var hm = this;
        if (hm.animateRoll) {
            clearInterval(hm.animateRoll);
            hm.animateRoll = null;
        }
    }
};

function Wall() {
    this.init.apply(this, arguments);
}
Wall.prototype = {
    padding: {x:0.02, y:0.02},
    init: function(heatmap) {
        var w = this,
            mulit_x = heatmap.ow/heatMapResource[heatmap.region].width,
            mulit_y = heatmap.oh/heatMapResource[heatmap.region].height,
            mulit = mulit_x < mulit_y ? mulit_x : mulit_y;
        heatmap.w = heatmap.ow*(1 - w.padding.x*2);
        heatmap.h = heatmap.oh*(1 - w.padding.y*2);
        heatmap.x = (heatmap.ow - heatmap.w)/2,
        heatmap.y = (heatmap.oh - heatmap.h)/2,
        heatmap.x2 = heatmap.x + heatmap.w,
        heatmap.y2 = heatmap.y + heatmap.h;
        w.heatmap = heatmap;
        w.draw();
    },
    draw: function() {
        var w = this;
        w.destory();
        w.wall = w.heatmap.add(merge(w.heatmap.options.wall, {"type":"rect",x:0, y:0, width:w.heatmap.ow, height:w.heatmap.oh}));
        w.bindEvent(w.wall);
    },
    destory: function() {
        if (this.wall) {
            this.wall.remove();
        }
    },
    bindEvent: function(el) {
        var w = this;
        el.click(function(e) {
            if (w.heatmap.animateRoll) {
                w.heatmap.stopAnimate();
            } else {
                w.heatmap.animate();
            }
        });
    }
};

function Legend() {
    this.init.apply(this, arguments);
}
Legend.prototype = {
    percent_h:0.1,
    space:10,
    rect_r: 2,
    init:function(heatmap) {
        var l = this,
            w = 0;

        l.options = heatmap.options.legend;
        l.heatmap = heatmap;
        l.locate = [];
        
        l.h = heatmap.h * l.percent_h;
        l.rect_w = l.h * 0.25;
        l.rect_h = l.rect_w * 0.75;
        for (var i in heatmap.legendconf) {
            var len = strlen(heatmap.legendconf[i].txt, l.options.off["font-size"]);
            l.locate[i] = len;
            w += len + l.rect_w + (w>0 ? l.space : 0);
        }
        l.w = w;
        var wall_padding = l.h*0.12;
        l.wall_w = l.w + wall_padding*2;
        l.wall_h = l.rect_h + wall_padding*2;
        l.wall_x = heatmap.x + (heatmap.w - l.wall_w)/2;
        l.wall_y = heatmap.y2 - l.wall_h;
        l.x = l.wall_x + wall_padding;
        l.y = l.wall_y + wall_padding;
        
        heatmap.h -= l.h;
        l.draw();
    },
    draw:function() {
        var l = this;
        l.destory();
        l.wall = l.heatmap.add(merge(l.options.wall, {"type":"rect", x:l.wall_x, y:l.wall_y, width:l.wall_w, height:l.wall_h, r:5}));
        for (var i in l.heatmap.legendconf) {
            var rect = l.heatmap.add({"type":"rect", x:l.x, y:l.y, width:l.rect_w, height:l.rect_h, r:l.rect_r});
            var txt = l.heatmap.add(merge(l.options.off, {"type":"text",x:l.x+l.rect_w+2, y:l.y+l.rect_h/2, text:l.heatmap.legendconf[i].txt}));
            l.bindEvent(i, txt);
            l.bindEvent(i, rect);
            l.cache[i] = {"rect": rect, "txt": txt};
            l.x += l.space + l.locate[i] + l.rect_w;
        }
    },
    show: function(index) {
        var l = this;
        for (var i in l.cache) {
            var attr = l.options.off;
            var attr_rect = {"fill":"#ccc", stroke:"none", "cursor":"pointer"};
            if (i==index) {
                attr = l.options.on;
                attr_rect.fill = l.heatmap.legendconf[i].fill;
                attr_rect.cursor = "";
            }
            l.cache[i].txt.attr(attr);
            l.cache[i].rect.attr(attr_rect);
        }
        l.current = index;
        if (l.options.show) {
            l.options.show(index);
        }
    },
    destory: function() {
        var l = this;
        if (l.cache) {
            for (var i in l.cache) {
                l.cache[i].rect.remove();
                l.cache[i].txt.remove();
            }
        }
        if (l.wall) {
            l.wall.remove();
            l.wall = null;
        }
        l.cache = {};
    },
    bindEvent:function(index, el) {
        var l = this;
        el.click(function(e) {
            if (index == l.current) {
                return;
            }
            l.heatmap.stopAnimate();
            l.heatmap.show(index);
        });
    }
};

function Ruler() {
    this.init.apply(this, arguments);
}
Ruler.prototype = {
    percent_w: 0.1,
    init: function(heatmap) {
        var r = this,
            txt_w = 0,
            txt_h = 0;
        r.options = heatmap.options.ruler;
        r.heatmap = heatmap;
        r.txt = {};

        r.unchangable = heatmap.sharecolors.length > 0 ? true : false;
        if (heatmap.sharegrade.length > 0) {
            r.txt.title = [];
            for (var i in heatmap.sharegrade) {
                var tmp = r.options.share["format"](heatmap.sharegrade[i]);
                var len = strlen(r.options.share["format"](tmp), r.options.txt["font-size"]);
                r.txt.title[i] = tmp;
                txt_w = len > txt_w ? len : txt_w;
            }
            r.txt.len = txt_w;
            txt_h = heatmap.grade.length;
        } else {
            for (var i in heatmap.grade) {
                r.txt[i] = {title:[], len: 0};
                var f = r.getFormater(i);
                for (var j in heatmap.grade[i]) {
                    var tmp = f(heatmap.grade[i][j]);
                    var len = strlen(tmp, r.options.txt["font-size"]);
                    r.txt[i].title[j] = tmp;
                    (r.txt[i].len < len) && (r.txt[i].len = len);
                    (txt_w < len) && (txt_w = len);
                }
                txt_h = heatmap.grade[i].length > txt_h ? heatmap.grade[i].length : txt_h;
            }
        }
        r.rect_w = r.percent_w * heatmap.w * 0.3;
        r.rect_h = r.rect_w * 0.75;
        r.w = r.rect_w*(1.2) + txt_w;
        r.x = heatmap.x2 - r.w;
        r.txt_w = txt_w;
        
        
        if (r.options["v-align"] === "top") {
            r.y = heatmap.y;
        } else {
            r.y = heatmap.y2 - txt_h*(r.rect_h + 1);
        }
        heatmap.w -= r.w;
    },
    draw: function(index) {
        var r = this,
            y = r.y;
        r.destory();
        r.current = index;
        var text = r.heatmap.sharegrade.length > 0 ? r.txt : r.txt[index];
        var txt_x = r.heatmap.x2 - text.len/2;
        for (var i in text.title) {
            var attr = r.heatmap.selectedgrade[i] ? r.heatmap.options.map.select : r.heatmap.options.map.plate;
            var rect = r.heatmap.add(merge(attr, {"type":"rect","fill":r.getColor(i), x:r.x, y:y, width:r.rect_w, height:r.rect_h})).toFront();
            var txt = r.heatmap.add(merge(r.options.txt, {"type":"text","text-anchor":"middle", x: txt_x, y: y + r.rect_h/2+1.5, text:text.title[i]})).toFront();
            r.bindEvent(rect, i);
            r.bindEvent(txt, i);
            r.cache.push({rect: rect, txt:txt});
            y += r.rect_h;
        }
        for (var i in r.heatmap.selectedgrade) {
            if (r.heatmap.selectedgrade[i]) {
                r.cache[i].rect.toFront();
            }
        }
    },
    getFormater: function(index) {
        return this.heatmap.data[index].format || format;
    },
    destory: function() {
        if (this.cache && this.cache.length > 0) {
            for (var i in this.cache) {
                this.cache[i].rect.remove();
                this.cache[i].txt.remove();
            }
        }
        this.cache = [];
    },
    bindEvent: function(element, grade) {
        var r = this;
        element.click(function() {
            if (r.heatmap.selectedgrade[grade]) {
                if (r.heatmap.selgradecounter === 0) {
                    return;
                }
                r.unselect(grade);
                r.heatmap.selgradecounter--;
                r.heatmap.selectedgrade[grade] = false;
            } else {
                r.select(grade);
                r.heatmap.selectedgrade[grade] = true;
                r.heatmap.selgradecounter ++;
            }
            r.heatmap.stopAnimate();
            r.heatmap.map.fillColor();
        });
    },
    select: function(index) {
        this.cache[index].rect.attr(this.heatmap.options.map.select).toFront();
    },
    unselect: function (index) {
        this.cache[index].rect.attr(this.heatmap.options.map.plate).toBack();
        this.heatmap.wall.wall.toBack();
    },
    getColor: function(i) {
        return this.unchangable ? this.heatmap.sharecolors[i] : this.heatmap.colors[this.current][i];
    }
};

function Map() {
    this.init.apply(this, arguments);
}
Map.prototype = {
    init:function(heatmap) {
        var mulit_x = heatmap.w/heatMapResource[heatmap.region].width,
            mulit_y = heatmap.h/heatMapResource[heatmap.region].height,
            mulit = mulit_x < mulit_y ? mulit_x : mulit_y,
            transform_x = heatmap.x + (heatmap.w - heatMapResource[heatmap.region].width*mulit)/2,
            transform_y = heatmap.y + (heatmap.h - heatMapResource[heatmap.region].height*mulit)/2;
        this.transform = 't,' + transform_x+','+transform_y+',s,'+mulit+','+mulit+',0,0';
        heatmap.options.map.txt["font-size"] = heatmap.options.map.txt["size"]/mulit;

        this.options = heatmap.options.map;
        this.heatmap = heatmap;
        this.keepFront = [];
        this.draw();
    },
    fillColor: function(index) {
        var map = this;
        if (typeof(index) === "undefined") {
            index = map.index;
        } else {
            map.index = index;
        }
        map.group = {};

        var plateattr = {transform: map.transform},
            txtattr = {transform: map.transform};
        for (var state in map.plate) {
            plateattr = merge(plateattr, map.options.plate, {opacity: 1, fill: map.heatmap.mapcolors[index][state], transform: map.transform});
            if (map.heatmap.selgradecounter > 0) {
                var g = map.heatmap.mapgrade[index][state];
                if (!map.heatmap.selectedgrade[g]) {
                    plateattr = merge(plateattr, map.options.plate, {fill: map.options.shadow});
                }
            }
            if (map.heatmap.canBack || $.inArray(state, map.heatmap.isClickable[index])>=0) {
                plateattr.cursor = "pointer";
                txtattr = merge(txtattr, map.options.txt, {"cursor": "pointer"});
            } else {
                plateattr.cursor = "";
                txtattr = merge(txtattr, map.options.txt, {"cursor": ""});
            }
            if (map.plate[state].el) {
                map.plate[state].el.attr(plateattr);
            } else {
                for (var i in map.plate[state].set) {
                    map.plate[state].set[i].attr(plateattr);
                }
            }
            map.txt[state].attr(txtattr).toFront();
        }
    },
    draw:function() {
        var map = this;
        var resource = heatMapResource[map.heatmap.region];
        map.destory();
        var attr = merge(map.options.plate, {fill: initcolor, type:"path"});
        for (var state in resource.child) {
            var val = resource.child[state];
            if (val.front) {
                map.keepFront.push(state);
            }
            if (val.path) {
                map.plate[state] = {name: val.name, el: map.heatmap.add(extend(attr, {path:val.path}))};
                map.bindEvent(map.plate[state].el, state, val.name);
            } else {
                map.plate[state] = {name: val.name, set:[]};
                for (var i in val.set) {
                    map.plate[state].set.push(map.heatmap.add(extend(attr, {path:val['set'][i].path})));
                    map.bindEvent(map.plate[state].set[i], state, val.name);
                }
            }
            map.txt[state] = map.heatmap.add(merge(map.options.txt, {type:"text", x:val.x, y:val.y, text:val.name}));
            map.bindEvent(map.txt[state], state, val.name);
        }
        map.front();
    },
    destory: function() {
        var map = this;
        if (map.plate) {
            for (var state in map.plate) {
                if (map.plate[state].el) {
                    map.plate[state].el.remove();
                } else {
                    for (var i in map.plate[state].set) {
                        map.plate[state].set[i].remove();
                    }
                }
                map.txt[state].remove();
            }
        }
        map.plate = {};
        map.txt = {};
    },
    bindEvent:function(element, state, name) {
        var map = this;
        element.mouseover(function(e){
            map.select(state);
            if (map.options.mouseover) {
                map.options.mouseover(e, state, name, map.index);
            }
        });
        element.mouseout(function(e){
            map.unselect(state);
            if (map.options.mouseout) {
                map.options.mouseout(e, state, name, map.index);
            }
        });
        if ($.inArray(state, map.heatmap.isClickable) || map.heatmap.canBack) {
            element.click(function(e){
                map.heatmap.goin(state);
                if (map.options.click) {
                    map.options.click(e, state, name, map.index, map.heatmap.canBack);
                }
            });
        }
    },
    front: function() {
        var map = this;
        if (map.keepFront.length > 0) {
            for (var state in map.keepFront) {
                var s = map.keepFront[state];
                if (map.plate[s].el) {
                    map.plate[s].el.toFront();
                } else {
                    for (var i in map.plate[s].set) {
                        map.plate[s].set[i].toFront();
                    }
                }
                map.txt[s].toFront();
            }
        }
    },
    select:function(state) {
        var map = this;
        if (map.heatmap.selgradecounter > 0) {
            return;
        }
        if (map.plate[state].el) {
            map.plate[state].el.animate(map.options.select, 100).toFront();
        } else if (map.plate[state].set) {
            for (var i in map.plate[state].set) {
                map.plate[state].set[i].animate(map.options.select, 100).toFront();
            }
        }
        map.txt[state].toFront();
        map.heatmap.ruler.select(map.heatmap.mapgrade[map.index][state]);
        map.heatmap.stopAnimate();
        map.front();
    },
    unselect:function(state) {
        var map = this;
        if (map.heatmap.selgradecounter > 0) {
            return;
        }
        if (typeof(map.plate[state]) === "undefined") {
            return;
        }
        if (map.plate[state].el) {
            map.plate[state].el.stop();
            map.plate[state].el.attr(map.options.plate).toBack();
        } else if (map.plate[state].set) {
            for (var i in map.plate[state].set) {
                map.plate[state].set[i].stop();
                map.plate[state].set[i].animate(map.options.plate, 50).toBack();
            }
        }
        map.txt[state].toFront();
        map.heatmap.ruler.unselect(map.heatmap.mapgrade[map.index][state]);
        map.heatmap.wall.wall.toBack();
    }
};

function Color() {
    this.init();
}
Color.prototype = {
    conf: [
        "#4571A7",
        "#ab4540",
        "#4cb625",
        "#6a5acd",
        "#87cefa",
        "#603913",
        "#daa520"
    ],
    init: function() {
        this.index = 0;
    },
    pick: function() {
        if (this.index < this.conf.length) {
            var c = this.conf[this.index];
            this.index ++;
        } else {
            var c = this.conf[0];
            this.index = 1;
        }
        return c;
    }
};

function extend(a, b) {
    if (!a) {
        a = {};
    }
    for (var n in b) {
        a[n] = b[n];
    }
    return a;
}

function merge() {
    var i,
    len = arguments.length,
    ret = {},
    doCopy = function (copy, original) {
        var value, key;
        if (typeof copy !== 'object') {
            copy = {};
        }
        for (key in original) {
            if (original.hasOwnProperty(key)) {
                value = original[key];
                if (value && typeof value === 'object' && Object.prototype.toString.call(value) !== '[object Array]' && typeof value.nodeType !== 'number') {
                    copy[key] = doCopy(copy[key] || {}, value);
                } else {
                    copy[key] = original[key];
                }
            }
        }
        return copy;
    };
    for (i = 0; i < len; i++) {
        ret = doCopy(ret, arguments[i]);
    }
    return ret;
}

function strlen(str, size) {
    str = str.toString();
    var realLength = 0, len = str.length;
    for (var i = 0; i < len; i++) {
        var charCode = str.charCodeAt(i);
        realLength += (charCode >= 0 && charCode <= 128) ? 5 : 11;
    }
    return realLength/9 * size;
}

function minNmax(data) {
    var min = max = null;
    for (var i in data) {
        if (min === null) {
            min = max = data[i];
        } else {
            min = data[i] < min ? data[i] : min;
            max = data[i] > max ? data[i] : max;
        }
    }
    return {"min":min, "max":max};
}

function isString(s) {
    return typeof s === 'string';
}

function dataGrade(min, max, steps) {
    var grade = [];
    if (min === max) {
        grade.push(max);
        return grade;
    }
    max = ceil(max);
    min = ceil(min);
    var step = (max-min)/steps;
    if (step > 1) {
        step = Math.ceil(step);
    }
    for (i=1; i<=steps; i++) {
        grade.push(Math.round((min+step*i)*100)/100);
    }
    return grade;
}

function ceil(tmp) {
    var num = 1;
    while (parseInt(tmp/100)) {
        tmp = tmp/10;
        num *= 10;
    }
    return Math.ceil(tmp)*num;
}

function colorGrade(start, end, steps) {
    var startrgb,endrgb,er,eg,eb,rint,gint,bint,r,g,b;
    //初始颜色
    startrgb = Raphael.getRGB(start);
    r = startrgb.r;
    g = startrgb.g;
    b = startrgb.b;
    //终止颜色
    endrgb = Raphael.getRGB(end);
    er = endrgb.r;
    eg = endrgb.g;
    eb = endrgb.b;

    steps--;
    if (steps >= 1) {
        rint = Math.floor(Math.abs(r-er)/steps);
        gint = Math.floor(Math.abs(g-eg)/steps);
        bint = Math.floor(Math.abs(b-eb)/steps);
        if(rint == 0) rint = 1;
        if(gint == 0) gint = 1;
        if(bint == 0) bint = 1;
    }

    var i = 1;
    var colors = ['rgb(' + r + ',' + g + ',' + b + ')'];
    while (i <= steps) {
        r = (r >= er) ? (r - rint) : parseInt(r) + parseInt(rint);
        g = (g >= eg) ? (g - gint) : parseInt(g) + parseInt(gint);
        b = (b >= eb) ? (b - bint) : parseInt(b) + parseInt(bint);
        colors.push('rgb(' + r + ',' + g + ',' + b + ')');
        i++;
    }
    return colors;
}

function format(num) {
    return num;
}
})(jQuery);
