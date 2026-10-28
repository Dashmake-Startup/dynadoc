import Konva from 'konva';

/* var width = window.innerWidth;
var height = window.innerHeight;
var GUIDELINE_OFFSET = 5;

var stage = new Konva.Stage({
  container: 'container',
  width: width,
  height: height,
});

var layer = new Konva.Layer();
stage.add(layer); 

// first generate random rectangles
for (var i = 0; i < 5; i++) {
  layer.add(
    new Konva.Rect({
      x: Math.random() * stage.width(),
      y: Math.random() * stage.height(),
      width: 50 + Math.random() * 50,
      height: 50 + Math.random() * 50,
      fill: Konva.Util.getRandomColor(),
      rotation: Math.random() * 360,
      draggable: true,
      name: 'object',
    })
  );
}
*/
export function snapToGrid() {
  var width = window.innerWidth;
  var height = window.innerHeight;
  var shadowOffset = 20;
  var tween = null;
  var blockSnapSize = 30;

  var shadowRectangle = new Konva.Rect({
    x: 0,
    y: 0,
    width: blockSnapSize * 6,
    height: blockSnapSize * 3,
    fill: '#FF7B17',
    opacity: 0.6,
    stroke: '#CF6412',
    strokeWidth: 3,
    dash: [20, 2]
  });

  function newRectangle(x, y, layer, stage) {
    let rectangle = new Konva.Rect({
      x: x,
      y: y,
      width: blockSnapSize * 6,
      height: blockSnapSize * 3,
      fill: '#fff',
      stroke: '#ddd',
      strokeWidth: 1,
      shadowColor: 'black',
      shadowBlur: 2,
      shadowOffset: { x: 1, y: 1 },
      shadowOpacity: 0.4,
      draggable: true
    });
    rectangle.on('dragstart', (e) => {
      shadowRectangle.show();
      shadowRectangle.moveToTop();
      rectangle.moveToTop();
    });
    rectangle.on('dragend', (e) => {
      rectangle.position({
        x: Math.round(rectangle.x() / blockSnapSize) * blockSnapSize,
        y: Math.round(rectangle.y() / blockSnapSize) * blockSnapSize
      });
      stage.batchDraw();
      shadowRectangle.hide();
    });
    rectangle.on('dragmove', (e) => {
      shadowRectangle.position({
        x: Math.round(rectangle.x() / blockSnapSize) * blockSnapSize,
        y: Math.round(rectangle.y() / blockSnapSize) * blockSnapSize
      });
      stage.batchDraw();
    });
    layer.add(rectangle);
  }

  var stage = new Konva.Stage({
    container: 'container',
    width: width,
    height: height
  });

  var gridLayer = new Konva.Layer();
  var padding = blockSnapSize;
  console.log(width, padding, width / padding);
  for (var i = 0; i < width / padding; i++) {
    gridLayer.add(new Konva.Line({
      points: [Math.round(i * padding) + 0.5, 0, Math.round(i * padding) + 0.5, height],
      stroke: '#ddd',
      strokeWidth: 1,
    }));
  }

  gridLayer.add(new Konva.Line({ points: [0, 0, 10, 10] }));
  for (var j = 0; j < height / padding; j++) {
    gridLayer.add(new Konva.Line({
      points: [0, Math.round(j * padding), width, Math.round(j * padding)],
      stroke: '#ddd',
      strokeWidth: 0.5,
    }));
  }

  var layer = new Konva.Layer();
  shadowRectangle.hide();
  layer.add(shadowRectangle);
  newRectangle(blockSnapSize * 3, blockSnapSize * 3, layer, stage);
  newRectangle(blockSnapSize * 10, blockSnapSize * 3, layer, stage);

  stage.add(gridLayer);
  stage.add(layer);

}

// To check https://github.com/faridmth/use-konva-snapping


// others
// https://konvajs.org/docs/select_and_transform/Rotation_Snaps.html
// https://konvajs.org/docs/select_and_transform/Resize_Snaps.html

// https://konvajs.org/docs/sandbox/Objects_Snapping.html
export function smartSnapping(stage: Konva.Stage, layer: Konva.Layer, GUIDELINE_OFFSET: number = 5) {
  // were can we snap our objects?
  function getLineGuideStops(skipShape) {
    // we can snap to stage borders and the center of the stage
    var vertical = [0, stage.width() / 2, stage.width()];
    var horizontal = [0, stage.height() / 2, stage.height()];

    // and we snap over edges and center of each object on the canvas
    stage.find('.object').forEach((guideItem) => {
      if (guideItem === skipShape) {
        return;
      }
      var box = guideItem.getClientRect();
      // and we can snap to all edges of shapes
      vertical.push([box.x, box.x + box.width, box.x + box.width / 2]);
      horizontal.push([box.y, box.y + box.height, box.y + box.height / 2]);
    });
    return {
      vertical: vertical.flat(),
      horizontal: horizontal.flat(),
    };
  }

  // what points of the object will trigger to snapping?
  // it can be just center of the object
  // but we will enable all edges and center
  function getObjectSnappingEdges(node) {
    var box = node.getClientRect();
    var absPos = node.absolutePosition();

    return {
      vertical: [
        {
          guide: Math.round(box.x),
          offset: Math.round(absPos.x - box.x),
          snap: 'start',
        },
        {
          guide: Math.round(box.x + box.width / 2),
          offset: Math.round(absPos.x - box.x - box.width / 2),
          snap: 'center',
        },
        {
          guide: Math.round(box.x + box.width),
          offset: Math.round(absPos.x - box.x - box.width),
          snap: 'end',
        },
      ],
      horizontal: [
        {
          guide: Math.round(box.y),
          offset: Math.round(absPos.y - box.y),
          snap: 'start',
        },
        {
          guide: Math.round(box.y + box.height / 2),
          offset: Math.round(absPos.y - box.y - box.height / 2),
          snap: 'center',
        },
        {
          guide: Math.round(box.y + box.height),
          offset: Math.round(absPos.y - box.y - box.height),
          snap: 'end',
        },
      ],
    };
  }

  // find all snapping possibilities
  function getGuides(lineGuideStops, itemBounds) {
    var resultV = [];
    var resultH = [];

    lineGuideStops.vertical.forEach((lineGuide) => {
      itemBounds.vertical.forEach((itemBound) => {
        var diff = Math.abs(lineGuide - itemBound.guide);
        // if the distance between guild line and object snap point is close we can consider this for snapping
        if (diff < GUIDELINE_OFFSET) {
          resultV.push({
            lineGuide: lineGuide,
            diff: diff,
            snap: itemBound.snap,
            offset: itemBound.offset,
          });
        }
      });
    });

    lineGuideStops.horizontal.forEach((lineGuide) => {
      itemBounds.horizontal.forEach((itemBound) => {
        var diff = Math.abs(lineGuide - itemBound.guide);
        if (diff < GUIDELINE_OFFSET) {
          resultH.push({
            lineGuide: lineGuide,
            diff: diff,
            snap: itemBound.snap,
            offset: itemBound.offset,
          });
        }
      });
    });

    var guides = [];

    // find closest snap
    var minV = resultV.sort((a, b) => a.diff - b.diff)[0];
    var minH = resultH.sort((a, b) => a.diff - b.diff)[0];
    if (minV) {
      guides.push({
        lineGuide: minV.lineGuide,
        offset: minV.offset,
        orientation: 'V',
        snap: minV.snap,
      });
    }
    if (minH) {
      guides.push({
        lineGuide: minH.lineGuide,
        offset: minH.offset,
        orientation: 'H',
        snap: minH.snap,
      });
    }
    return guides;
  }

  function drawGuides(guides) {
    guides.forEach((lg) => {
      if (lg.orientation === 'H') {
        var line = new Konva.Line({
          points: [-6000, 0, 6000, 0],
          stroke: 'rgb(0, 161, 255)',
          strokeWidth: 1,
          name: 'guid-line',
          dash: [4, 6],
        });
        layer.add(line);
        line.absolutePosition({
          x: 0,
          y: lg.lineGuide,
        });
      } else if (lg.orientation === 'V') {
        var line = new Konva.Line({
          points: [0, -6000, 0, 6000],
          stroke: 'rgb(0, 161, 255)',
          strokeWidth: 1,
          name: 'guid-line',
          dash: [4, 6],
        });
        layer.add(line);
        line.absolutePosition({
          x: lg.lineGuide,
          y: 0,
        });
      }
    });
  }

  layer.on('dragmove', function (e) {
    // clear all previous lines on the screen
    layer.find('.guid-line').forEach((l) => l.destroy());

    // find possible snapping lines
    var lineGuideStops = getLineGuideStops(e.target);
    // find snapping points of current object
    var itemBounds = getObjectSnappingEdges(e.target);

    // now find where can we snap current object
    var guides = getGuides(lineGuideStops, itemBounds);

    // do nothing of no snapping
    if (!guides.length) {
      return;
    }

    drawGuides(guides);

    var absPos = e.target.absolutePosition();
    // now force object position
    guides.forEach((lg) => {
      switch (lg.orientation) {
        case 'V': {
          absPos.x = lg.lineGuide + lg.offset;
          break;
        }
        case 'H': {
          absPos.y = lg.lineGuide + lg.offset;
          break;
        }
      }
    });
    e.target.absolutePosition(absPos);
  });

  layer.on('dragend', function (e) {
    // clear all previous lines on the screen
    layer.find('.guid-line').forEach((l) => l.destroy());
  });
}
