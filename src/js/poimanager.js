POIManager = (function() {

    var hideTagPatterns = ['^source$', '^created_by$', '^AND_'];

    var shownNodeIDs = [];

    function getTagFilters(zoom_level) {
        var tags = [];
        if(zoom_level >= 17) {
            return [];
        }
        for(var i = 1; i <= zoom_level; i++) {
            tags.push.apply(tags, zoomLevelData[i]);
        }
        return tags;
    }
    function getPOIsInBounds(bounds) {
        var d = $.Deferred();

        var queryTemplate = templates.getTemplate('query-template');

        var sw = bounds.getSouthWest();
        var ne = bounds.getNorthEast();
        var query = queryTemplate({
            ne: ne, 
            sw: sw,
            tags: getTagFilters(map.getZoom())
        });
        console.log(query);
        startSpinning("#show-poi");
        $.ajax({
            url: overpassBaseURL,
            data: {
                data: query
            },
            dataType: "text",
            success: function(resp) {
                var $x = $($.parseXML(resp)); 
                var elements = $x.find('node'); 
                var pois = $.grep(elements, function(element) {
                    var tags = $(element).find('tag');
                    var id = $(element).attr('id');
                    var ignored_tags = 0;
                    if(tags.length) {
                        tags.each(function(i, tag) {
                            var key = $(tag).attr('k');
                            var value = $(tag).attr('v');
                            $.each(hideTagPatterns, function(i, regex) {
                                if(key.match(new RegExp(regex))) {
                                    ignored_tags += 1;
                                }
                            });
                        });
                    }
                    return tags.length != ignored_tags && ($.inArray(id, shownNodeIDs) == -1); 
                });
                stopSpinning("#show-poi");
                d.resolve(_.map(pois, function(poi) { return POI.fromXml(poi); }));
            },
            error: function(err) {
                d.reject(err); 
            }
        });

        return d;
    }
    
    function showPOI(poi) {
        var poiTemplate = templates.getTemplate("poi-template");
        $("#poi-content").empty().html(poiTemplate(poi));

        $.mobile.changePage('#poi-page');
        poiTapBar.setState("empty");
        var removedTags = {};

        function tapHoldBehavior() {
            console.log('in taphold');
            if($(this).attr('id') !== 'no-tags-item') {
                var key = $(this).find('.poi-tag-key').text().trim();
                var value = $(this).find('.poi-tag-value').text().trim();
                if($(this).hasClass("to-delete-tag")) {
                    var sure = confirm("Undelete " + key + "?");
                    if(sure) {
                        $(this).removeClass("to-delete-tag");
                        delete removedTags[key];
                        if($("#poi-tags-list > li.to-delete-tag").length || $("#poi-tags-list > li.unsaved-tag").length) {
                            poiTapBar.setState("save");
                        } else {
                            poiTapBar.setState("empty");
                        }
                    }
                } else {
                    var sure = confirm("Delete " + key + "?");
                    if(sure) {
                        if($(this).hasClass("unsaved-tag")) {
                            $(this).remove();
                        } else {
                            $(this).addClass("to-delete-tag");
                        }
                        removedTags[key] = value;
                        if($("#poi-tags-list > li.to-delete-tag").length || $("#poi-tags-list > li.unsaved-tag").length) {
                            poiTapBar.setState("save");
                        } else {
                            poiTapBar.setState("empty");
                        }
                    }
                }
            }
        }
        function refreshListAppearance() {
            $("#poi-tags-list > li").last().removeClass("ui-corner-bottom");
            $("#poi-tags-list > li").last().bind('taphold', tapHoldBehavior).bind('vmousedown', function() {
                $(this).addClass("ui-btn-down-c");
            }).bind('vmouseup', function() {
                $(this).removeClass("ui-btn-down-c");
            });
        }
        $("#poi-page").trigger("create");
        $("#new-tag-container > h3 > a").removeClass("ui-corner-top").bind('vclick', function() {
            $(this).toggleClass("ui-corner-bottom");
        });
        $("#poi-tags-list > li").bind('taphold', tapHoldBehavior);
        $("#poi-tags-list > li").bind('vmousedown', function() {
            $(this).addClass("ui-btn-down-c");
        }).bind('vmouseup', function() {
            $(this).removeClass("ui-btn-down-c");
        });
        $("#poi-tags-list > li").last().removeClass("ui-corner-bottom");

        $("#new-tag-submit").click(function() {
            var k = $.trim($("#new-tag-key").val());
            var v = $.trim($("#new-tag-value").val());
            if(k != "" && v != "") {
                poi.tags[k] = v;
                $("#no-tags-item").hide();
                $("#poi-tags-list").append("<li class='unsaved-tag ui-body-e'><span class='poi-tag-key'>" + k + "</span>: <span class='poi-tag-value'>" + v + "</span></li>").listview('refresh');
                $("#new-tag-key").val("");
                $("#new-tag-value").val("");
                $("#save-poi").removeClass("disabled");
                refreshListAppearance();
                poiTapBar.setState("save");
            }
            return false;
        });


        // Hacky code for now. Need to figure out best way to maintain 'curPOI' state
        $("#save-poi").unbind('vclick').bind('vclick', function() {
            $.each(removedTags, function(key, value) {
                delete poi[key];
            });
            poiTapBar.setState("saving");
            poi.save(currentChangesetID).done(function(ver) {
                poi.version = ver;
                $("#poi-tags-list > li.ui-body-e").removeClass("ui-body-e").addClass("ui-body-c");
                $("#poi-tags-list > li.to-delete-tag").removeClass("to-delete-tag").remove();;
                poiTapBar.setState("saved");
                history.back();
            }).fail(function() {
                poiTapBar.setState("save-failed");
            });
        });
    }

    function displayPOIMarker(poi) {
        var d = $.Deferred();
        console.log(poi);
        var marker = new L.Marker(poi.location);
        var popup = new L.Popup({offset: new L.Point(0, -20)}, poi);
        var popupContent = $("<div><strong>" + poi.name + "</strong></div>").click(function() {
            showPOI(poi);
            map.openPopup(popup);
        })[0];
        popup.setLatLng(poi.location);
        popup.setContent(popupContent);
        marker.on('click', function() {
            map.openPopup(popup);
        });
        map.addLayer(marker);
        shownNodeIDs.push(poi.id);

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
                var poi = POI.fromXml($(resp).find('node')[0]);
                d.resolve(poi);
            },
            error: function(err) {
                console.log('no POI for id ' + id);
                console.log(JSON.stringify(err));
                d.reject(err);
            }
        });
        return d;
    }

    function createPOI(location, name) {
        var d = $.Deferred();

        var poi = new POI({
            location: location,
            tags: {
                name: name
            }
        });
        var poiXml = poi.toXml(currentChangesetID);

        $.ajax({
            url: OSMbaseURL + '/api/0.6/node/create',
            type: 'POST',
            data: '<osm>' + poiXml + "</osm>",
            beforeSend: makeBeforeSend("PUT"), 
            success: function(id) {
                retrievePOI(id).then(function(poi) {
                    displayPOIMarker(poi).then(function(marker, popup) { 
                        map.openPopup(popup);
                    });
                    showPOI(poi);
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
        createPOI: createPOI,
        showPOI: showPOI,
        retrievePOI: retrievePOI,
        displayPOIMarker: displayPOIMarker
    };
})();
