class UnoGame {
    constructor() {
        this.players = [
            { name: 'Player', hand: [], isHuman: true },
            { name: 'Bot 1', hand: [], isHuman: false },
            { name: 'Bot 2', hand: [], isHuman: false },
            { name: 'Bot 3', hand: [], isHuman: false }
        ];
        this.currentPlayerIndex = 0;
        this.direction = 1; // 1 for clockwise, -1 for counter-clockwise
        this.drawPile = [];
        this.discardPile = [];
        this.currentCard = null;
        this.gameEnded = false;
        this.waitingForColorChoice = false;
        
        // Timer properties
        this.turnTimer = null;
        this.timeLeft = 20;
        this.maxTime = 20;
        
        this.initializeGame();
        this.setupEventListeners();
    }

    initializeGame() {
        this.createDeck();
        this.shuffleDeck();
        this.dealCards();
        this.setStartingCard();
        this.updateUI();
        this.startTimer();
    }

    createDeck() {
        const colors = ['red', 'yellow', 'green', 'blue'];
        const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        const specialCards = ['skip', 'reverse', '+2'];
        
        this.drawPile = [];

        // Number cards (0 has 1 copy, 1-9 have 2 copies each per color)
        colors.forEach(color => {
            this.drawPile.push({ color, value: '0', type: 'number' });
            for (let i = 1; i <= 9; i++) {
                this.drawPile.push({ color, value: i.toString(), type: 'number' });
                this.drawPile.push({ color, value: i.toString(), type: 'number' });
            }
        });

        // Special cards (2 copies each per color)
        colors.forEach(color => {
            specialCards.forEach(special => {
                this.drawPile.push({ color, value: special, type: 'special' });
                this.drawPile.push({ color, value: special, type: 'special' });
            });
        });

        // Wild cards (4 of each)
        for (let i = 0; i < 4; i++) {
            this.drawPile.push({ color: 'wild', value: 'wild', type: 'wild' });
            this.drawPile.push({ color: 'wild', value: 'wild+4', type: 'wild' });
        }
    }

    shuffleDeck() {
        for (let i = this.drawPile.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j], this.drawPile[i]];
        }
    }

    dealCards() {
        // Deal 7 cards to each player
        for (let i = 0; i < 7; i++) {
            this.players.forEach(player => {
                player.hand.push(this.drawPile.pop());
            });
        }
    }

    setStartingCard() {
        // Find a number card to start with
        let startingCardIndex = this.drawPile.findIndex(card => card.type === 'number');
        if (startingCardIndex === -1) {
            // If no number card found, shuffle and try again
            this.shuffleDeck();
            startingCardIndex = this.drawPile.findIndex(card => card.type === 'number');
        }
        
        this.currentCard = this.drawPile.splice(startingCardIndex, 1)[0];
        this.discardPile.push(this.currentCard);
    }

    setupEventListeners() {
        document.getElementById('restart-btn').addEventListener('click', () => {
            this.restartGame();
        });

        document.getElementById('draw-pile').addEventListener('click', () => {
            if (this.currentPlayerIndex === 0 && !this.gameEnded && !this.waitingForColorChoice) {
                this.drawCard(this.players[0]);
                this.nextTurn();
            }
        });

        // Color picker modal
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                this.handleColorChoice(color);
            });
        });
    }

    drawCard(player) {
        if (this.drawPile.length === 0) {
            this.reshuffleDiscardPile();
        }
        
        if (this.drawPile.length > 0) {
            player.hand.push(this.drawPile.pop());
            this.updateUI();
        }
    }

    reshuffleDiscardPile() {
        if (this.discardPile.length <= 1) return;
        
        // Keep the current card, shuffle the rest back into draw pile
        const currentCard = this.discardPile.pop();
        this.drawPile = [...this.discardPile];
        this.discardPile = [currentCard];
        this.shuffleDeck();
        this.showMessage('Deck reshuffled!', 1500);
    }

    canPlayCard(card) {
        if (card.type === 'wild') return true;
        
        return card.color === this.currentCard.color || 
               card.value === this.currentCard.value;
    }

    playCard(playerIndex, cardIndex) {
        const player = this.players[playerIndex];
        const card = player.hand[cardIndex];

        if (!this.canPlayCard(card)) {
            if (playerIndex === 0) {
                this.showMessage('Invalid move!', 1500);
            }
            return false;
        }

        // Stop timer when a valid card is played
        this.stopTimer();

        // Remove card from player's hand
        player.hand.splice(cardIndex, 1);
        
        // Add to discard pile
        this.discardPile.push(card);
        this.currentCard = card;

        // Handle special cards
        this.handleSpecialCard(card);

        // Check for win
        if (player.hand.length === 0) {
            this.endGame(playerIndex);
            return true;
        }

        this.updateUI();
        return true;
    }

    handleSpecialCard(card) {
        switch (card.value) {
            case 'skip':
                this.nextTurn(); // Skip next player
                break;
            case 'reverse':
                this.direction *= -1;
                document.getElementById('direction').textContent = 
                    this.direction === 1 ? 'Clockwise' : 'Counter-clockwise';
                break;
            case '+2':
                this.nextTurn();
                const nextPlayer = this.players[this.currentPlayerIndex];
                this.drawCard(nextPlayer);
                this.drawCard(nextPlayer);
                this.showMessage(`${nextPlayer.name} draws 2 cards!`, 2000);
                break;
            case 'wild':
                this.waitingForColorChoice = true;
                if (this.players[this.currentPlayerIndex].isHuman) {
                    this.showColorPicker();
                } else {
                    // Bot chooses color
                    const colors = ['red', 'yellow', 'green', 'blue'];
                    const chosenColor = colors[Math.floor(Math.random() * colors.length)];
                    this.handleColorChoice(chosenColor);
                }
                return; // Don't advance turn yet
            case 'wild+4':
                this.nextTurn();
                const targetPlayer = this.players[this.currentPlayerIndex];
                for (let i = 0; i < 4; i++) {
                    this.drawCard(targetPlayer);
                }
                this.showMessage(`${targetPlayer.name} draws 4 cards!`, 2000);
                this.waitingForColorChoice = true;
                this.currentPlayerIndex = (this.currentPlayerIndex - this.direction + this.players.length) % this.players.length;
                if (this.players[this.currentPlayerIndex].isHuman) {
                    this.showColorPicker();
                } else {
                    // Bot chooses color
                    const colors = ['red', 'yellow', 'green', 'blue'];
                    const chosenColor = colors[Math.floor(Math.random() * colors.length)];
                    this.handleColorChoice(chosenColor);
                }
                return; // Don't advance turn yet
        }
    }

    showColorPicker() {
        document.getElementById('color-picker-modal').style.display = 'block';
    }

    hideColorPicker() {
        document.getElementById('color-picker-modal').style.display = 'none';
    }

    handleColorChoice(color) {
        this.currentCard.color = color;
        this.waitingForColorChoice = false;
        this.hideColorPicker();
        this.updateUI();
        this.nextTurn();
    }

    nextTurn() {
        if (this.gameEnded || this.waitingForColorChoice) return;
        
        this.stopTimer();
        this.currentPlayerIndex = (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
        this.updateUI();
        this.startTimer();

        // If it's a bot's turn, play automatically
        if (!this.players[this.currentPlayerIndex].isHuman) {
            setTimeout(() => {
                this.botPlay();
            }, 1000);
        }
    }

    botPlay() {
        const bot = this.players[this.currentPlayerIndex];
        const playableCards = bot.hand.map((card, index) => ({ card, index }))
            .filter(({ card }) => this.canPlayCard(card));

        if (playableCards.length > 0) {
            // Bot AI: Prefer special cards, then wild cards, then regular cards
            playableCards.sort((a, b) => {
                const scoreA = this.getBotCardScore(a.card);
                const scoreB = this.getBotCardScore(b.card);
                return scoreB - scoreA;
            });

            const chosenCard = playableCards[0];
            this.playCard(this.currentPlayerIndex, chosenCard.index);
        } else {
            // Draw a card
            this.drawCard(bot);
            this.showMessage(`${bot.name} draws a card`, 1500);
        }

        if (!this.waitingForColorChoice && !this.gameEnded) {
            this.nextTurn();
        }
    }

    getBotCardScore(card) {
        // Higher score = higher priority
        if (card.value === 'wild+4') return 10;
        if (card.value === 'wild') return 9;
        if (card.value === '+2') return 8;
        if (card.value === 'skip') return 7;
        if (card.value === 'reverse') return 6;
        return parseInt(card.value) || 1;
    }

    startTimer() {
        if (this.gameEnded || this.waitingForColorChoice) return;
        
        this.timeLeft = this.maxTime;
        this.updateTimerDisplay();
        
        this.turnTimer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            if (this.timeLeft <= 0) {
                this.handleTimeOut();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
    }

    updateTimerDisplay() {
        const timerDisplay = document.getElementById('timer-display');
        const timerProgress = document.getElementById('timer-progress');
        
        timerDisplay.textContent = this.timeLeft;
        
        // Update progress bar
        const progressPercent = (this.timeLeft / this.maxTime) * 100;
        timerProgress.style.width = `${progressPercent}%`;
        
        // Update timer styling based on time left
        timerDisplay.classList.remove('warning', 'critical');
        if (this.timeLeft <= 5) {
            timerDisplay.classList.add('critical');
        } else if (this.timeLeft <= 10) {
            timerDisplay.classList.add('warning');
        }
    }

    handleTimeOut() {
        this.stopTimer();
        
        const currentPlayer = this.players[this.currentPlayerIndex];
        
        if (currentPlayer.isHuman) {
            // Human player times out - draw a card and skip turn
            this.drawCard(currentPlayer);
            this.showMessage(`Time's up! You drew a card.`, 2000);
        } else {
            // Bot times out - draw a card (this shouldn't normally happen)
            this.drawCard(currentPlayer);
            this.showMessage(`${currentPlayer.name} took too long and drew a card.`, 2000);
        }
        
        this.nextTurn();
    }

    endGame(winnerIndex) {
        this.stopTimer();
        this.gameEnded = true;
        const winner = this.players[winnerIndex];
        
        if (winner.isHuman) {
            this.showMessage('🎉 You Win! 🎉', 0);
        } else {
            this.showMessage(`😔 ${winner.name} Wins! 😔`, 0);
        }
    }

    restartGame() {
        this.stopTimer();
        this.players.forEach(player => player.hand = []);
        this.currentPlayerIndex = 0;
        this.direction = 1;
        this.drawPile = [];
        this.discardPile = [];
        this.currentCard = null;
        this.gameEnded = false;
        this.waitingForColorChoice = false;
        this.timeLeft = this.maxTime;
        
        this.hideColorPicker();
        document.getElementById('game-message').style.display = 'none';
        
        this.initializeGame();
    }

    updateUI() {
        this.updatePlayerHand();
        this.updateBotHands();
        this.updateCurrentCard();
        this.updateDrawPile();
        this.updateCurrentPlayer();
    }

    updatePlayerHand() {
        const handElement = document.getElementById('player-hand');
        handElement.innerHTML = '';
        
        this.players[0].hand.forEach((card, index) => {
            const cardElement = this.createCardElement(card);
            cardElement.addEventListener('click', () => {
                if (this.currentPlayerIndex === 0 && !this.gameEnded && !this.waitingForColorChoice) {
                    if (this.playCard(0, index)) {
                        cardElement.classList.add('playing');
                        if (!this.waitingForColorChoice && !this.gameEnded) {
                            this.nextTurn();
                        }
                    }
                }
            });
            handElement.appendChild(cardElement);
        });
    }

    updateBotHands() {
        for (let i = 1; i < this.players.length; i++) {
            const botElement = document.getElementById(`bot${i}`);
            const countElement = botElement.querySelector('.count');
            const cardsElement = botElement.querySelector('.bot-cards');
            
            countElement.textContent = this.players[i].hand.length;
            
            // Show face-down cards
            cardsElement.innerHTML = '';
            for (let j = 0; j < Math.min(this.players[i].hand.length, 10); j++) {
                const cardElement = document.createElement('div');
                cardElement.className = 'bot-card';
                cardsElement.appendChild(cardElement);
            }
        }
    }

    updateCurrentCard() {
        const cardElement = document.getElementById('current-card');
        if (this.currentCard) {
            cardElement.className = `card ${this.currentCard.color}`;
            cardElement.innerHTML = `<div class="card-content">${this.getCardDisplay(this.currentCard)}</div>`;
        }
    }

    updateDrawPile() {
        document.getElementById('draw-count').textContent = this.drawPile.length;
    }

    updateCurrentPlayer() {
        const currentPlayerName = document.getElementById('current-player-name');
        currentPlayerName.textContent = this.players[this.currentPlayerIndex].name;
        
        // Update active player styling
        document.querySelectorAll('.bot-player, .player-container').forEach(el => {
            el.classList.remove('active');
        });
        
        if (this.currentPlayerIndex === 0) {
            document.querySelector('.player-container').classList.add('active');
        } else {
            document.getElementById(`bot${this.currentPlayerIndex}`).classList.add('active');
        }
    }

    createCardElement(card) {
        const cardElement = document.createElement('div');
        cardElement.className = `card ${card.color}`;
        cardElement.innerHTML = `<div class="card-content">${this.getCardDisplay(card)}</div>`;
        return cardElement;
    }

    getCardDisplay(card) {
        switch (card.value) {
            case 'skip': return '🚫';
            case 'reverse': return '🔄';
            case '+2': return '+2';
            case 'wild': return '🌈';
            case 'wild+4': return '🌈+4';
            default: return card.value;
        }
    }

    showMessage(message, duration = 0) {
        const messageElement = document.getElementById('game-message');
        messageElement.textContent = message;
        messageElement.style.display = 'block';
        
        if (duration > 0) {
            setTimeout(() => {
                messageElement.style.display = 'none';
            }, duration);
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new UnoGame();
});
