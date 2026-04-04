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
let currentTurnCaptured = [];

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
        lockedAt,
        currentTurnCaptured
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
                currentTurnCaptured = state.currentTurnCaptured || [];
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
    currentTurnCaptured = [];
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
                
                if (currentTurnCaptured.some(cap => cap.r === r && cap.c === c)) {
                    pieceEl.classList.add('captured');
                }
                
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

function getRawMoves(r, c, bState, capturedPieces) {
    const piece = bState[r][c];
    if (!piece) return [];
    let validMoves = [];
    
    if (piece.isKing) {
        const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        directions.forEach(dir => {
            let step = 1;
            let foundOpponent = null;
            while (true) {
                let nr = r + step * dir[0], nc = c + step * dir[1];
                if (!bounds(nr, nc)) break;
                
                let target = bState[nr][nc];
                let isCap = capturedPieces.some(cap => cap.r === nr && cap.c === nc);
                
                if (target === null || isCap) {
                    if (foundOpponent) {
                        if (target === null) {  
                            validMoves.push({ type: 'jump', r: nr, c: nc, captured: foundOpponent });
                        }
                    } else if (capturedPieces.length === 0 && target === null) {
                        validMoves.push({ type: 'move', r: nr, c: nc });
                    }
                } else {
                    if (isCap) break; 
                    if (target.player === piece.player) break;
                    if (foundOpponent) break;
                    foundOpponent = {r: nr, c: nc};
                }
                step++;
            }
        });
    } else {
        const moveDirs = piece.player === PLAYER_1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
        const jumpDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        
        if (capturedPieces.length === 0) {
            moveDirs.forEach(dir => {
                let nr = r + dir[0], nc = c + dir[1];
                if (bounds(nr, nc) && bState[nr][nc] === null) {
                    validMoves.push({ type: 'move', r: nr, c: nc });
                }
            });
        }
        jumpDirs.forEach(dir => {
           let nr = r + dir[0], nc = c + dir[1];
           let jr = r + 2 * dir[0], jc = c + 2 * dir[1];
           if (bounds(jr, jc) && bounds(nr, nc)) {
               let target = bState[nr][nc];
               let landing = bState[jr][jc];
               let isCap = capturedPieces.some(cap => cap.r === nr && cap.c === nc);
               let isLandingCap = capturedPieces.some(cap => cap.r === jr && cap.c === jc);
               
               if (target !== null && target.player !== piece.player && !isCap && landing === null && !isLandingCap) {
                   validMoves.push({ type: 'jump', r: jr, c: jc, captured: { r: nr, c: nc } });
               }
           }
        });
    }
    return validMoves;
}

function getJumpPaths(r, c, bState, capturedPieces) {
    let jumps = getRawMoves(r, c, bState, capturedPieces).filter(m => m.type === 'jump');
    if (jumps.length === 0) return { maxContent: 0, bestPaths: [] };
    
    let maxLength = 0;
    let bestPaths = [];
    
    jumps.forEach(jump => {
        let piece = bState[r][c];
        bState[r][c] = null;
        bState[jump.r][jump.c] = piece;
        capturedPieces.push(jump.captured);
        
        let sub = getJumpPaths(jump.r, jump.c, bState, capturedPieces);
        let pathLength = 1 + sub.maxContent;
        
        if (pathLength > maxLength) {
            maxLength = pathLength;
            bestPaths = [{ move: jump, maxContent: pathLength }];
        } else if (pathLength === maxLength) {
            bestPaths.push({ move: jump, maxContent: pathLength });
        }
        
        capturedPieces.pop();
        bState[jump.r][jump.c] = null;
        bState[r][c] = piece;
    });
    
    return { maxContent: maxLength, bestPaths: bestPaths };
}

function getMaxGlobalJumps(player, bState) {
    let globalMax = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (bState[r][c] && bState[r][c].player === player) {
                let jInfo = getJumpPaths(r, c, bState, []);
                if (jInfo.maxContent > globalMax) {
                    globalMax = jInfo.maxContent;
                }
            }
        }
    }
    return globalMax;
}

function getValidMovesConstrained(r, c) {
    const piece = board[r][c];
    if (!piece || piece.player !== currentPlayer) return [];
    
    if (currentTurnCaptured.length > 0) {
       let info = getJumpPaths(r, c, board, currentTurnCaptured);
       return info.bestPaths.map(p => p.move);
    }
    
    let globalMax = getMaxGlobalJumps(currentPlayer, board);
    if (globalMax > 0) {
       let info = getJumpPaths(r, c, board, []);
       if (info.maxContent === globalMax) {
           return info.bestPaths.map(p => p.move);
       }
       return [];
    }
    
    return getRawMoves(r, c, board, []).filter(m => m.type === 'move');
}

function bounds(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function handleSquareClick(r, c) {
    if (currentPlayer === 0 || isLocked) return;
    
    const clickedPiece = board[r][c];
    
    if (clickedPiece && clickedPiece.player === currentPlayer) {
        if (selectedPiece && selectedPiece.mustJump) {
             if (selectedPiece.r === r && selectedPiece.c === c) {
                 // valid
             } else {
                 return; 
             }
        } else {
            let movesForClicked = getValidMovesConstrained(r, c);
            if (movesForClicked.length === 0) return;
            selectedPiece = { r, c };
            updateUI();
        }
        return;
    }
    
    if (!clickedPiece && selectedPiece) {
        const filterMoves = getValidMovesConstrained(selectedPiece.r, selectedPiece.c);
        const move = filterMoves.find(m => m.r === r && m.c === c);
        
        if (move) {
            executeMove(move);
        } else {
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
    
    board[move.r][move.c] = piece;
    board[selectedPiece.r][selectedPiece.c] = null;
    
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
        currentTurnCaptured.push(move.captured);
        jumped = true;
    }
    
    if (jumped && !promote) {
        selectedPiece = { r: move.r, c: move.c, mustJump: true };
        let fut = getValidMovesConstrained(move.r, move.c);
        if (fut.length > 0) {
             updateUI();
             saveState();
             return;
        }
    }
    
    currentTurnCaptured.forEach(cap => {
        board[cap.r][cap.c] = null;
        if (currentPlayer === PLAYER_1) p2PiecesLeft--;
        else p1PiecesLeft--;
    });
    currentTurnCaptured = [];
    
    selectedPiece = null;
    currentPlayer = currentPlayer === PLAYER_1 ? PLAYER_2 : PLAYER_1;
    
    updateUI();
    saveState();
}

function highlightValidMoves() {
    if (!selectedPiece) return;
    
    const filterMoves = getValidMovesConstrained(selectedPiece.r, selectedPiece.c);
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
                let raw = getRawMoves(r, c, board, []);
                if (raw.length > 0) {
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
        currentPlayer = 0; 
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
