POIManager = (function() {
    var deleteTags = ['^source$', '^created_by$', '^AND_'];

    var shownNodeIDs = [];

    function getPOIsInBounds(bounds) {
        var d = $.Deferred();

        var sw = bounds.getSouthWest();
        var nw = bounds.getNorthEast();
        var boundsString = "(" + sw.lat + "," + sw.lng + "," + nw.lat + "," + nw.lng + ")";
        console.log(boundsString);
        $.ajax({
            url: "http://overpass.osm.rambler.ru/cgi/interpreter", 
            data: {
                data: "node" + boundsString + ";out body;"
            },
            dataType: "text",
            success: function(resp) {
                var $x = $($.parseXML(resp)); 
                var elements = $x.find('node'); 
                var pois = $.grep(elements, function(element) {
                    var tags = $(element).find('tag');
                    if(tags.length) {
                        var to_delete = [];
                        tags.each(function(i, tag) {
                            var key = $(tag).attr('k');
                            var value = $(tag).attr('v');
                            $.each(deleteTags, function(i, regex) {
                                if(key.match(new RegExp(regex))) {
                                    to_delete.push(tag);
                                }
                            });
                        });

                        $.each(to_delete, function(i, tag) {
                            $(tag).remove();
                        });
                    }
                    return $(element).find('tag').length && ($.inArray(element.id, shownNodeIDs) == -1); 
                });
                d.resolve(pois);
            },
            error: function(err) {
                console.reject(err); 
            }
        });

        return d;
    }
    
    function convertForDisplay(poi) {
        var tags = [];
        var name = "Not named";
        var $poi = $(poi);
        $poi.find('tag').each(function(i, tag) {
            $tag = $(tag);
            var key = $(tag).attr('k');
            var value = $(tag).attr('v');
            if(key == 'name') {
                name = value;
            } else {
                tags.push({'key': key, 'value': value});
            }
        });
        return {
            id: $poi.attr('id'),
            lat: $poi.attr('lat'),
            lon: $poi.attr('lon'),
            name: name,
            tags: tags
        };
    }

    function showPOI(poi) {
        var template = templates.getTemplate("poi-template");
        $("#poi-content").empty().html(template.render(poi));
        $("#poi-name").html(poi.name || 'No name');
        $.mobile.changePage('#poi-page');
        $("#poi-page").trigger("create");
    }

    function displayPOIs(pois) {
        $.each(pois, function(i, poi) {
            var poiData = convertForDisplay(poi);
            var point = new L.LatLng(poiData.lat, poiData.lon);
            var marker = new L.Marker(point);
            var popup = new L.Popup({offset: new L.Point(0, -20)}, poi);
            var popupContent = $("<div><strong>" + poiData.name + "</strong></div>").click(function() {
                showPOI(poiData);
                map.openPopup(popup);
            })[0];
            popup.setLatLng(point);
            popup.setContent(popupContent);
            marker.on('click', function() {
                map.openPopup(popup);
            });
            map.addLayer(marker);
            shownNodeIDs.push(poiData.id);
        });
    }
    
    function createPOI(lat, lon, name) {
        var template = templates.getTemplate("node-template");
        var poiData = {
            changeset_id: currentChangesetID,
            lat: lat,
            lon: lon,
            tags: [
                {key: 'name', value: name}
            ]
        };
        var poiXml = template.render(poiData);
        console.log(poiXml);
        $.ajax({
            url: OSMbaseURL + '/api/0.6/node/create',
            type: 'POST',
            data: poiXml,
            beforeSend: function(xhr) {
                xhr.setRequestHeader("X_HTTP_METHOD_OVERRIDE", "PUT");
                xhr.setRequestHeader("Authorization", "Basic " + btoa(localStorage.userName + ":" + localStorage.password));
            },
            success: function(resp) {
                alert("created with id #" + resp);
            },
            error: function(err) {
                console.log(JSON.stringify(err));
            }
        });
    }

    return {
        getPOIsInBounds: getPOIsInBounds,
        displayPOIs: displayPOIs,
        createPOI: createPOI
    };
})();
