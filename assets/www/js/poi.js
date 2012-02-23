POIManager = (function() {
    var deleteTags = ['^source$', '^created_by$', '^AND_'];

    var shownNodeIDs = [];

    function getPOIsInBounds(bounds) {
        var d = $.Deferred();

        var sw = bounds.getSouthWest();
        var nw = bounds.getNorthEast();
        var boundsString = "(" + sw.lat + "," + sw.lng + "," + nw.lat + "," + nw.lng + ")";
        console.log(boundsString);
        startSpinImg("#show-poi");
        $.ajax({
            url: overpassBaseURL,
            data: {
                data: "node" + boundsString + ";out meta;"
            },
            dataType: "text",
            success: function(resp) {
                var $x = $($.parseXML(resp)); 
                var elements = $x.find('node'); 
                var pois = $.grep(elements, function(element) {
                    var tags = $(element).find('tag');
                    var id = $(element).attr('id');
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
                    return $(element).find('tag').length && ($.inArray(id, shownNodeIDs) == -1); 
                });
                stopSpinImg("#show-poi");
                d.resolve(pois);
            },
            error: function(err) {
                d.reject(err); 
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
        // Assume that if there's no meta information, user just created this thing :)
        return {
            id: $poi.attr('id'),
            lat: $poi.attr('lat'),
            lon: $poi.attr('lon'),
            lastUpdate: $.timeago($poi.attr('timestamp') || new Date()),
            lastUser: $poi.attr('user') || localStorage.userName,
            name: name,
            tags: tags
        };
    }

    function showPOI(poi) {
        var template = templates.getTemplate("poi-template");
        $("#poi-content").empty().html(template.render(poi));
        $.mobile.changePage('#poi-page');
        $("#poi-page").trigger("create");
    }

    function displayPOIMarker(poi) {
        var d = $.Deferred();

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

        d.resolve(marker, popup);
        return d;
    }

    function displayPOIMarkers(pois) {
        $.each(pois, function(i, poi) {
            displayPOIMarker(poi);
        });
    }
   
    function retrievePOI(id) {
        var d = $.Deferred();
        $.ajax({
            url: OSMbaseURL + '/api/0.6/node/' + id,
            type: 'GET',
            datatype: 'xml',
            beforeSend: function(xhr) {
                xhr.setRequestHeader("Authorization", "Basic " + btoa(localStorage.userName + ":" + localStorage.password));
            },
            success: function(resp) {
                var node = $(resp).find('node');
                displayPOIMarker(node);
                d.resolve(node);
            },
            error: function(err) {
                console.log('no POI for id ' + id);
                console.log(JSON.stringify(err));
                d.reject(err);
            }
        });
        return d;
    }

    function createPOI(lat, lon, name) {
        var d = $.Deferred();

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
            beforeSend: makeBeforeSend("PUT"), 
            success: function(id) {
                retrievePOI(id).then(function(node) {
                    displayPOIMarker(node).then(function(marker, popup) { 
                        map.openPopup(popup);
                    });
                });
                d.resolve(id);
            },
            error: function(err) {
                console.log(JSON.stringify(err));
                d.reject(err);
            }
        });
        return d;
    }

    return {
        getPOIsInBounds: getPOIsInBounds,
        displayPOIMarkers: displayPOIMarkers,
        createPOI: createPOI
    };
})();
