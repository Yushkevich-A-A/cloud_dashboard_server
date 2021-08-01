module.exports = {
  eventSubscription: {
    translationEvent: function(item) {
      this.handlers.forEach(h => h(item));
    },
    handlers: [],
    listen: function(handler) {
      this.handlers.push(handler);
    }
  }
}