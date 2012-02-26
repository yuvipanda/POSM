(function() {
    function TapBar(barSelector, states) {
        this.$bar = $(barSelector);
        this.states = states;

        this.transitionTime = 2 * 1000;

        TapBar.prototype.setState = function(state_name) {
            var state = this.states[state_name];
            this.$bar.html(state.text).unbind('vclick').bind('vclick', state.callback);
            if(state.disabled) {
                this.$bar.attr("disabled", "disabled").removeClass("img-btn").removeClass("ui-btn-up-a");
            } else {
                this.$bar.removeAttr("disabled").addClass("img-btn").addClass("ui-btn-up-a");
            }

            if(state.next) {
                var me = this;
                setTimeout(function() {
                    me.setState(state.next);
                }, this.transitionTime);
            }
        }
    }

    window.TapBar = TapBar;
})();
