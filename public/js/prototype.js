var log = console.log;

var gebi = n => document.getElementById(n);
var qs = n => document.querySelector(n);

Math.TAU = Math.PI * 2;
Math.step = (x,st) => Math.floor(x / st) * st;
Math.mod = (a, b) => a - Math.floor(a / b) * b;
Math.clamp = (x, m = 0, M = 1) => Math.min(Math.max(x, m), M);

Math.lerp = (a, b, x = 0.5) => a + (b - a) * x;
Math.invlerp = (a, b, x) => (x - a) / (b - a);

Math.deg = x => x / Math.PI * 180;
Math.rad = x => x / 180 * Math.PI;

//Make Array from length and function(i)
Array.make = function(len, func){
    return new Array(len).fill(0).map((_,i)=>func(i));
};

//Repeat an array X times
Array.prototype.repeat = function(n) {
    let a = [], i;
    for (i = 0; i < n; i++) {
        a.push(...this);
    }
    return a;
};
//Average of array of numbers
Array.prototype.average = function() {
    return this.sum() / this.length;
};
//Returns the sum of an array
Array.prototype.sum = function() {
    return this.reduce((a, b) => a + b, 0);
};