(function() {
    var hideTagPatterns = ['^source$', '^created_by$', '^AND_'];

    function POI(data) {
        // Simply attatch to self
        _.each(data, function(value, key) {
            this[key] = value;
        }, this);

        var xmlTemplate = templates.getTemplate('node-template');
        POI.prototype.toXml = function(changesetId) {
            console.log(this);
            return xmlTemplate(_.extend({
                    changesetId: changesetId
                }, this));
        }
    }

    POI.fromXml = function(node) {
        var tags = {};
        _.each(node.getElementsByTagName("tag"), function(tag) {
            tags[tag.getAttribute("k")] = tag.getAttribute("v");
        });

        return new POI({
            id: node.getAttribute("id"),
            location: new L.LatLng(node.getAttribute('lat'), node.getAttribute('lon')),
            version: node.getAttribute('version'),
            timestamp: node.getAttribute('timestamp'),
            user: {
                name: node.getAttribute('user'),
                id: node.getAttribute('uid')
            },
            tags: tags,
            name: tags.name
        });
            
    }

    window.POI = POI;
})();
