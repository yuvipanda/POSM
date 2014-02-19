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

        POI.prototype.save = function(changesetId) {

            var required_attrs = ['id', 'version', 'changeset', 'lat', 'lon'];

            var d = $.Deferred();

            var poiXml = this.toXml(changesetId);

            console.log(poiXml);
            $.ajax({
                url: OSMbaseURL + '/api/0.6/node/' + this.id,
                type: 'POST',
                data: "<osm>" +  poiXml + "</osm>",
                beforeSend: makeBeforeSend("PUT"),
                success: function(resp) {
                    d.resolve(resp);
                },
                error: function(err) {
                    console.log("Failed :( " + JSON.stringify(err));
                    d.reject(err);
                },
                timeout: 30 * 1000
            });

            return d;
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
