const BOARD_SIZE = 10;
const PLAYER_1 = 1; // Red - starts bottom, moves up
const PLAYER_2 = 2; // Blue - starts top, moves down

let board = [];
let currentPlayer = PLAYER_1;
let selectedPiece = null;
let p1PiecesLeft = 20;
let p2PiecesLeft = 20;
let isLocked = false;
let lockedAt = null;

// Elements
const boardEl = document.getElementById('board');
const p1ScoreEl = document.getElementById('p1-score');
const p2ScoreEl = document.getElementById('p2-score');
const p1StatusEl = document.getElementById('player1-status');
const p2StatusEl = document.getElementById('player2-status');
const turnIndicatorEl = document.getElementById('turn-indicator');
const restartBtn = document.getElementById('restart-btn');
const lockBtn = document.getElementById('lock-btn');
const lockTimeEl = document.getElementById('lock-time');
const overlayEl = document.getElementById('message-overlay');
const winnerTextEl = document.getElementById('winner-text');
const playAgainBtn = document.getElementById('play-again-btn');

function saveState() {
    const state = {
        board,
        currentPlayer,
        p1PiecesLeft,
        p2PiecesLeft,
        selectedPiece,
        isLocked,
        lockedAt
    };
    localStorage.setItem('checkers_state', JSON.stringify(state));
}

function initGame(forceReset = false) {
    overlayEl.classList.add('hidden');
    
    if (!forceReset) {
        const saved = localStorage.getItem('checkers_state');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                board = state.board;
                currentPlayer = state.currentPlayer;
                p1PiecesLeft = state.p1PiecesLeft;
                p2PiecesLeft = state.p2PiecesLeft;
                selectedPiece = state.selectedPiece;
                isLocked = state.isLocked || false;
                lockedAt = state.lockedAt || null;
                updateLockUI();
                updateUI();
                return;
            } catch(e) {
                console.error("Failed to parse saved state", e);
            }
        }
    }

    if (forceReset && isLocked) return;

    board = [];
    currentPlayer = PLAYER_1;
    selectedPiece = null;
    p1PiecesLeft = 20;
    p2PiecesLeft = 20;
    isLocked = false;
    lockedAt = null;
    updateLockUI();
    
    // Initialize logic board
    for (let r = 0; r < BOARD_SIZE; r++) {
        let row = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
            if ((r + c) % 2 === 1) { // Dark squares
                if (r < 4) row.push({ player: PLAYER_2, isKing: false });
                else if (r > 5) row.push({ player: PLAYER_1, isKing: false });
                else row.push(null);
            } else {
                row.push(null); // Light squares are not playable
            }
        }
        board.push(row);
    }
    
    updateUI();
    saveState();
}

function renderBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const squareEl = document.createElement('div');
            squareEl.classList.add('square');
            squareEl.classList.add((r + c) % 2 === 0 ? 'light' : 'dark');
            squareEl.dataset.row = r;
            squareEl.dataset.col = c;
            
            if ((r + c) % 2 === 1) {
                squareEl.addEventListener('click', () => handleSquareClick(r, c));
            }
            
            const pieceData = board[r][c];
            if (pieceData) {
                const pieceEl = document.createElement('div');
                pieceEl.classList.add('piece');
                pieceEl.classList.add(pieceData.player === PLAYER_1 ? 'player1' : 'player2');
                if (pieceData.isKing) pieceEl.classList.add('king');
                
                if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
                    squareEl.classList.add('selected');
                }
                
                squareEl.appendChild(pieceEl);
            }
            
            boardEl.appendChild(squareEl);
        }
    }
    
    highlightValidMoves();
}

function updateUI() {
    p1ScoreEl.textContent = p1PiecesLeft;
    p2ScoreEl.textContent = p2PiecesLeft;
    
    if (currentPlayer === PLAYER_1) {
        p1StatusEl.classList.add('active');
        p2StatusEl.classList.remove('active');
        turnIndicatorEl.textContent = "Player 1's Turn";
    } else {
        p1StatusEl.classList.remove('active');
        p2StatusEl.classList.add('active');
        turnIndicatorEl.textContent = "Player 2's Turn";
    }
    
    renderBoard();
    checkWinCondition();
}

function getValidMoves(r, c) {
    const piece = board[r][c];
    if (!piece || piece.player !== currentPlayer) return [];
    
    let validMoves = [];
    
    // Non-kings only move forward, but can jump in all 4 directions. 
    // Kings can do both in all 4 directions.
    const moveDirections = piece.isKing ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : 
                           (piece.player === PLAYER_1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);
    const jumpDirections = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
                       
    // Simple moves
    moveDirections.forEach(dir => {
        let nr = r + dir[0], nc = c + dir[1];
        if (bounds(nr, nc) && board[nr][nc] === null) {
            validMoves.push({ type: 'move', r: nr, c: nc });
        }
    });
        
    // Jump moves
    jumpDirections.forEach(dir => {
        let dr = dir[0], dc = dir[1];
        let nr = r + dr, nc = c + dc;
        let jr = r + 2 * dr, jc = c + 2 * dc;
        
        if (bounds(jr, jc) && bounds(nr, nc) && 
            board[nr][nc] !== null && board[nr][nc].player !== piece.player && 
            board[jr][jc] === null) {
            validMoves.push({ type: 'jump', r: jr, c: jc, captured: { r: nr, c: nc } });
        }
    });
    
    return validMoves;
}

function hasAnyJumps(player) {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] && board[r][c].player === player) {
                const tempCurrent = currentPlayer;
                currentPlayer = player;
                const moves = getValidMoves(r, c);
                currentPlayer = tempCurrent;
                
                if (moves.some(m => m.type === 'jump')) {
                    return true;
                }
            }
        }
    }
    return false;
}

function bounds(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function handleSquareClick(r, c) {
    if (currentPlayer === 0 || isLocked) return; // Game over or locked
    
    const clickedPiece = board[r][c];
    
    // Select own piece
    if (clickedPiece && clickedPiece.player === currentPlayer) {
        if (selectedPiece && selectedPiece.mustJump) {
             if (selectedPiece.r === r && selectedPiece.c === c) {
                 // valid, it's the one that must jump
             } else {
                 return; // Ignore selecting other pieces
             }
        } else {
            if (hasAnyJumps(currentPlayer)) {
                const movesForClicked = getValidMoves(r, c);
                if (!movesForClicked.some(m => m.type === 'jump')) {
                    return; // Forced jump required, cannot select this piece
                }
            }
            selectedPiece = { r, c };
            updateUI();
        }
        return;
    }
    
    // Move to empty square
    if (!clickedPiece && selectedPiece) {
        const moves = getValidMoves(selectedPiece.r, selectedPiece.c);
        
        let filterMoves = moves;
        if (selectedPiece.mustJump || hasAnyJumps(currentPlayer)) {
            filterMoves = moves.filter(m => m.type === 'jump');
        }

        const move = filterMoves.find(m => m.r === r && m.c === c);
        
        if (move) {
            executeMove(move);
        } else {
            // Clicked empty square but invalid move, deselect if not forced to jump
            if (!selectedPiece.mustJump) {
                selectedPiece = null;
                updateUI();
                saveState();
            }
        }
    }
}

function executeMove(move) {
    const piece = board[selectedPiece.r][selectedPiece.c];
    
    // Move piece
    board[move.r][move.c] = piece;
    board[selectedPiece.r][selectedPiece.c] = null;
    
    // Check Kinging
    let promote = false;
    if (!piece.isKing) {
        if ((piece.player === PLAYER_1 && move.r === 0) || 
            (piece.player === PLAYER_2 && move.r === BOARD_SIZE - 1)) {
            piece.isKing = true;
            promote = true;
        }
    }
    
    let jumped = false;
    if (move.type === 'jump') {
        const cap = move.captured;
        board[cap.r][cap.c] = null;
        if (piece.player === PLAYER_1) p2PiecesLeft--;
        else p1PiecesLeft--;
        jumped = true;
    }
    
    // Check for multiple jumps if we just jumped
    if (jumped && !promote) {
        selectedPiece = { r: move.r, c: move.c };
        const furtherMoves = getValidMoves(move.r, move.c).filter(m => m.type === 'jump');
        if (furtherMoves.length > 0) {
             selectedPiece.mustJump = true;
             updateUI();
             saveState();
             return; // Don't switch turns
        }
    }
    
    // End Turn
    selectedPiece = null;
    currentPlayer = currentPlayer === PLAYER_1 ? PLAYER_2 : PLAYER_1;
    
    updateUI();
    saveState();
}

function highlightValidMoves() {
    if (!selectedPiece) return;
    
    const moves = getValidMoves(selectedPiece.r, selectedPiece.c);
    
    // If must jump, filter only jumps
    let filterMoves = moves;
    if (selectedPiece.mustJump || hasAnyJumps(currentPlayer)) {
        filterMoves = moves.filter(m => m.type === 'jump');
    }
    
    const squares = boardEl.children;
    filterMoves.forEach(m => {
        const index = m.r * BOARD_SIZE + m.c;
        if(squares[index]) {
            squares[index].classList.add('highlight');
        }
    });
}

function checkWinCondition() {
    let p1HasMoves = false;
    let p2HasMoves = false;
    
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c]) {
                const player = board[r][c].player;
                const tempCurrent = currentPlayer;
                currentPlayer = player;
                const moves = getValidMoves(r, c);
                currentPlayer = tempCurrent;
                
                if (moves.length > 0) {
                    if (player === PLAYER_1) p1HasMoves = true;
                    if (player === PLAYER_2) p2HasMoves = true;
                }
            }
        }
    }

    let winner = null;
    if (p1PiecesLeft === 0 || (!p1HasMoves && currentPlayer === PLAYER_1)) winner = 2;
    if (p2PiecesLeft === 0 || (!p2HasMoves && currentPlayer === PLAYER_2)) winner = 1;
    
    if (winner) {
        currentPlayer = 0; // stop play
        winnerTextEl.textContent = `Player ${winner} Wins!`;
        winnerTextEl.style.color = winner === 1 ? 'var(--p1-piece)' : 'var(--p2-piece)';
        overlayEl.classList.remove('hidden');
        localStorage.removeItem('checkers_state');
    }
}

restartBtn.addEventListener('click', () => initGame(true));
playAgainBtn.addEventListener('click', () => initGame(true));

function toggleLock() {
    isLocked = !isLocked;
    if (isLocked) {
        lockedAt = new Date().toLocaleString();
    } else {
        lockedAt = null;
    }
    updateLockUI();
    saveState();
}

function updateLockUI() {
    if (isLocked) {
        lockBtn.textContent = 'Unlock Game';
        lockBtn.classList.add('locked');
        if (lockedAt) {
            lockTimeEl.textContent = `Locked: ${lockedAt}`;
            lockTimeEl.classList.remove('hidden');
        }
    } else {
        lockBtn.textContent = 'Lock Game';
        lockBtn.classList.remove('locked');
        lockTimeEl.classList.add('hidden');
        lockTimeEl.textContent = '';
    }
}

lockBtn.addEventListener('click', toggleLock);

// Start game on load
initGame();
