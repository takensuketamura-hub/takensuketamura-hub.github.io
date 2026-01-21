const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const BLOCK = 30;
const COLS = 10;
const ROWS = 20;

// フィールド
const board = Array.from({ length: ROWS }, () =>
  Array(COLS).fill(0)
);

// ミノ
const SHAPES = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
  [[1, 1, 0], [0, 1, 1]],
  [[0, 1, 1], [1, 1, 0]]
];

const COLORS = [
  null,
  "cyan",
  "yellow",
  "purple",
  "orange",
  "blue",
  "green",
  "red"
];

let piece = createPiece();
let lastTime = 0;
let dropInterval = 500;

function createPiece() {
  const index = Math.floor(Math.random() * SHAPES.length);
  return {
    shape: SHAPES[index],
    color: COLORS[index + 1],
    x: 3,
    y: 0
  };
}

function drawBlock(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
  ctx.strokeStyle = "#111";
  ctx.strokeRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
}

function drawBoard() {
  board.forEach((row, y) => {
    row.forEach((v, x) => {
      if (v) drawBlock(x, y, COLORS[v]);
    });
  });
}

function drawPiece() {
  piece.shape.forEach((row, y) => {
    row.forEach((v, x) => {
      if (v) drawBlock(piece.x + x, piece.y + y, piece.color);
    });
  });
}

function collide() {
  return piece.shape.some((row, y) =>
    row.some((v, x) => {
      if (!v) return false;
      const nx = piece.x + x;
      const ny = piece.y + y;
      return (
        nx < 0 ||
        nx >= COLS ||
        ny >= ROWS ||
        board[ny]?.[nx]
      );
    })
  );
}

function merge() {
  piece.shape.forEach((row, y) => {
    row.forEach((v, x) => {
      if (v) board[piece.y + y][piece.x + x] = COLORS.indexOf(piece.color);
    });
  });
}

function clearLines() {
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(v => v)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(0));
      y++;
    }
  }
}

function rotate() {
  const rotated = piece.shape[0].map((_, i) =>
    piece.shape.map(r => r[i]).reverse()
  );
  const prev = piece.shape;
  piece.shape = rotated;
  if (collide()) piece.shape = prev;
}

function drop() {
  piece.y++;
  if (collide()) {
    piece.y--;
    merge();
    clearLines();
    piece = createPiece();
  }
}

document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") {
    piece.x--;
    if (collide()) piece.x++;
  }
  if (e.key === "ArrowRight") {
    piece.x++;
    if (collide()) piece.x--;
  }
  if (e.key === "ArrowDown") {
    drop();
  }
  if (e.key === "ArrowUp") {
    rotate();
  }
});

function update(time = 0) {
  const delta = time - lastTime;
  if (delta > dropInterval) {
    drop();
    lastTime = time;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoard();
  drawPiece();
  requestAnimationFrame(update);
}

update();
