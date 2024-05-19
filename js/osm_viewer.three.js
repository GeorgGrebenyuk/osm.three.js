//https://wiki.openstreetmap.org/wiki/Mercator#JavaScript
PI = Math.PI;
RAD2DEG = 180/PI;
DEG2RAD = PI/180;
R =  6378137.0

function y2lat(y) { return (2 * Math.atan( Math.exp(y / R)) - PI/2 ) * RAD2DEG }
function x2lon(x) { return RAD2DEG * (x/R); }

function lat2y(lat) { return Math.log(Math.tan(PI/4 + lat * DEG2RAD / 2)) * R}
function lon2x(lon) { return lon * DEG2RAD * R; }

/**
 * Class for describe OSM feature (point, linestring, polygon)
 */
class OSM_Feature{
	Id = "";
	TreeJS_Id = 0;
	Feature_type;
	Attributes = {};
	Properties= {};
	#p_geometry;

	constructor(){

    }

	getGeometry(){
        return this.#p_geometry;
    }
	setGeometry(value){
		if (value !== undefined) this.#p_geometry = value;
		
	}
}

/**
 * Class for parsing OSM-vector file to getting all features
 */
class OSM_Processing{

	/**
	 * The collection of all OSM-elements (geometry with tags). Class OSM_Feature
	 */
	OSM_Features = [];

	/**
	 * The internal coordinates of scene (as centroid of all OSM-data points)
	 * X, meters = Longitude, grad.; Y, meters = Latitude, grad.;
	 */
	#osm_offset_point = [0.0, 0.0];

	/**
	 * The temporary dictionary (id: coords) for OSM's nodes (point items)
	 */
	#osm_nodes = {};

	/**
	 * The temporary dictionary (id: coords) for OSM's ways (polygons) which are closed
	 */
	#osm_ways = {};

	/**
	 * The constructor of OSM_Processing class
	 * @param {*} file_osm_data The FileReader result
	 * @returns nothing
	 */
	constructor(file_osm_data){
		this.ClearData();
	}

	/**
	 * Read OSM file and parse it entities
	 * @param {*} file_osm_data The FileReader result
	 * @returns 
	 */
	LoadData(file_osm_data){
		if (file_osm_data === undefined) {
			console.log( 'No OSM model provided!' );
			return;
		}
		var file_osm_data_xml = $.parseXML(file_osm_data);
		var file_osm_data_xml_content = file_osm_data_xml.children[0];

		for(let i=0; i < file_osm_data_xml_content.children.length; i++)
		{
			let osm_content_section = file_osm_data_xml_content.children[i];
			//console.log( osm_content_section );
			if (i == 0) this.#osm_processing_parse_bounds(osm_content_section);
			else{
				this.#osm_processing_parse_xml(osm_content_section);
			}
		}
	}

	/**
	 * Parse nested XML-element "bounds" to calc global extent in meters of that OSM-file
	 * @param {*} XML_Data The XML-element for <bounds>
	 */
	#osm_processing_parse_bounds(XML_Data){
		var bounds_min_lat_temp = lat2y(parseFloat(XML_Data.attributes[0].value));
		var bounds_min_long_temp = lon2x(parseFloat(XML_Data.attributes[1].value));
		var bounds_max_lat_temp = lat2y(parseFloat(XML_Data.attributes[2].value));
		var bounds_max_long_temp = lon2x(parseFloat(XML_Data.attributes[3].value));

		this.#osm_offset_point[0] = (bounds_min_long_temp + bounds_max_long_temp)/2.0;
		this.#osm_offset_point[1] = (bounds_min_lat_temp + bounds_max_lat_temp)/2.0;
	}

	/**
	 * Parse each nested XML-element in "osm" block besides "bounds"
	 * @param {*} XML_Data 
	 */
	#osm_processing_parse_xml(XML_Data){
		var osm_feature = new OSM_Feature();
		let three_geometry = null;

		osm_feature.Attributes = this.#osm_processing_get_attributes(XML_Data);
		osm_feature.Properties = this.#osm_processing_get_tags(XML_Data);
		osm_feature.Id = osm_feature.Attributes["id"];

		var XML_Data_Name = XML_Data.localName;
		if (XML_Data_Name == "node")
		{
			osm_feature.Feature_type = "point";
			var osm_node_lat = lat2y(parseFloat(osm_feature.Attributes["lat"]));
			var osm_node_long = lon2x(parseFloat(osm_feature.Attributes["lon"]));
			var osm_node_coords = [osm_node_long - this.#osm_offset_point[0], osm_node_lat - this.#osm_offset_point[1]];

			this.#osm_nodes[osm_feature.Id] = osm_node_coords;
				
			const three_sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), this.#osm_get_material(osm_feature.Properties));
			three_sphere.position.set(osm_node_coords[0], osm_node_coords[1], 0);
			three_geometry = three_sphere;
		}
		else if (XML_Data_Name == "way")
		{
			var geometry_point_coords = [];
			var three_points = [];
			var point_ids = [];

			for(let i=0; i < XML_Data.children.length; i++)
			{
				let osm_subItem = XML_Data.children[i];
				if (osm_subItem.localName == "nd"){
					var node_ref_num = (osm_subItem.attributes[0].value).toString();
					var node_point = this.#osm_nodes[node_ref_num];

					three_points.push( new THREE.Vector3( node_point[0], node_point[1], 0.0 ) );
					geometry_point_coords.push([node_point[0], node_point[1]]);
					point_ids.push(node_ref_num);
				}
			}
			
			

			var is_closed = false;
			var is_building = false;
			if (osm_feature.Properties.hasOwnProperty("building") && osm_feature.Properties["building"].length > 0) is_building = true;

			if (point_ids[0] == point_ids[point_ids.length - 1]) is_closed = true;

			if (!is_closed) {
				osm_feature.Feature_type = "linestring";
				const three_geometry_temp = new THREE.BufferGeometry().setFromPoints( three_points );
				const three_line = new THREE.Line(three_geometry_temp, this.#osm_get_material(osm_feature.Properties) );
				three_geometry = three_line;
			}
			else{
				const three_shape = new THREE.Shape();
				three_shape.moveTo(geometry_point_coords[0][0], geometry_point_coords[0][1]);
				for (let counter = 1; counter < geometry_point_coords.length; counter++ )
				{
					var point_next = geometry_point_coords[counter];
					three_shape.lineTo(point_next[0], point_next[1]);
				}

				this.#osm_ways[osm_feature.Id] = three_shape;

				if (is_building) {
					osm_feature.Feature_type = "solid";
					var depth_value = 1;
					if (osm_feature.Properties.hasOwnProperty("building:levels")) depth_value = parseInt(osm_feature.Properties["building:levels"]);
					var extrudeSettings = {
						steps: 1,
						depth: depth_value * 3.0,
						bevelEnabled: false,
					};
					const three_geom_temp = new THREE.ExtrudeGeometry(three_shape, extrudeSettings);
					const three_mesh = new THREE.Mesh(three_geom_temp, this.#osm_get_material(osm_feature.Properties) );
					three_geometry = three_mesh;

				}
				else{
					osm_feature.Feature_type = "polygon";
					const three_geom_temp = new THREE.ShapeGeometry( three_shape );
					const three_mesh = new THREE.Mesh(three_geom_temp, this.#osm_get_material(osm_feature.Properties));
					three_geometry = three_mesh;
				}
			}
		}
		else if (XML_Data_Name == "relation")
		{	
			//Only for "outer" and "inner" items yet, other -- TODO ...
			var is_building = false;
			if (osm_feature.Properties.hasOwnProperty("building") && osm_feature.Properties["building"].length > 0) is_building = true;
			var depth_value = 1;
			if (osm_feature.Properties.hasOwnProperty("building:levels")) depth_value = parseInt(osm_feature.Properties["building:levels"]);

			let three_shapes_outer = [];
			let three_shapes_inner = [];

			for(let i=0; i < XML_Data.children.length; i++)
			{
				let osm_subItem = XML_Data.children[i];
				if (osm_subItem.localName == "member")
				{
					var attrs = this.#osm_processing_get_attributes(osm_subItem);
					if (attrs.hasOwnProperty("role") && (attrs["role"] == "outer" || attrs["role"] == "inner"))
					{
						//let osm_feature_that = this.GetFeatureById(attrs["ref"]);
						if (attrs["role"] == "outer") three_shapes_outer.push(this.#osm_ways[attrs["ref"]]);
						else if (attrs["role"] == "inner") three_shapes_inner.push(this.#osm_ways[attrs["ref"]]);		
					}	
				}
			}
			

			if (three_shapes_outer.length > 0)
			{
				if (is_building) osm_feature.Feature_type = "solid";
				else osm_feature.Feature_type = "polygon";
				var extrudeSettings = {
					steps: 1,
					depth: depth_value * 3.0,
					bevelEnabled: false,
				};

				for (let i_g = 0; i_g < three_shapes_outer.length; i_g++ )
				{
					let one_shape = three_shapes_outer[i_g];
					let one_shape2 = one_shape;
					
					if (three_shapes_inner.length > 0)
					{
						//TODO: Реализовать механику проверки через точку и луч
						for (let i_g2 = 0; i_g2 < three_shapes_inner.length; i_g2++ )
						{
							let one_shape_inner = three_shapes_inner[i_g2];
							if (one_shape_inner !== undefined)
							{
								const temp_points = one_shape_inner.getPoints();
								// draw the hole
								const three_holePath_temp = new THREE.Shape(temp_points.reverse())
								// add hole to shape
								if (one_shape === undefined) one_shape = one_shape2;
								try{
									one_shape.holes.push(one_shape_inner);
								}
								catch (error) {
									//console.log("Error in creation building with hole!");
									//console.error(error);
									one_shape = one_shape2;
							  	}
							}							
						}
					}
					if (one_shape === undefined) one_shape = one_shape2;
					

					let three_geom_temp;
					if (is_building) three_geom_temp = new THREE.ExtrudeGeometry(one_shape, extrudeSettings);
					else three_geom_temp = new THREE.ShapeGeometry( one_shape );

					let mat = this.#osm_get_material(osm_feature.Properties);

					const three_mesh = new THREE.Mesh(three_geom_temp, mat);


					//Create new feature
					var osm_feature_2 = new OSM_Feature();
					osm_feature_2.Attributes = osm_feature.Attributes;
					osm_feature_2.Properties = osm_feature.Properties;
					osm_feature_2.Feature_type = osm_feature.Feature_type;
					osm_feature_2.setGeometry(three_mesh);
					this.OSM_Features.push(osm_feature_2);
				}
				//three_geometry = new THREE.Mesh(three_temp_geom2, this.#default_material);
			}	



		}

		if (three_geometry != null){
			osm_feature.setGeometry(three_geometry);
			osm_feature.TreeJS_Id = three_geometry.id;
			this.OSM_Features.push(osm_feature);
		}

		
	}

	/**
	 * Parse all element's attributes to dictionary
	 * @param {*} XML_Data 
	 * @returns The dictionary with attributes
	 */
	#osm_processing_get_attributes(XML_Data){

		var temp_dict = {};
		//attributes
		for (let a_i = 0; a_i < XML_Data.attributes.length; a_i++)
		{
			var xml_attribute = XML_Data.attributes[a_i];
			temp_dict[xml_attribute.localName] = xml_attribute.value;
		}
		return temp_dict;
	}

	/**
	 * Parse all element's properties (in tag-elements) to dictionary
	 * @param {*} XML_Data 
	 * @returns The dictionary with tags
	 */
	#osm_processing_get_tags(XML_Data){

		var temp_dict = {};
		//tags
		for(let i=0; i < XML_Data.children.length; i++)
		{
			let osm_subItem = XML_Data.children[i];
			if (osm_subItem.localName == "tag")
			{
				var osm_subItem_Key = "";
				var osm_subItem_Value = "";

				for (let i = 0; i < osm_subItem.attributes.length; i++)
				{
					var xml_attribute = osm_subItem.attributes[i];
					var xml_attribute_value = xml_attribute.value;
					var xml_attribute_name = xml_attribute.localName;
				
					if (xml_attribute_name == "k") osm_subItem_Key = xml_attribute_value;
					else if (xml_attribute_name == "v") osm_subItem_Value = xml_attribute_value;
				}

				if (osm_subItem_Key != "")
				{
					temp_dict[osm_subItem_Key] = osm_subItem_Value;
				}
			}
		}
		return temp_dict;
	}

	/**
	 * Get material code (HTML color) by propeties
	 * @param {*} Attrs The tags dictionary for OSM feature
	 */
	#osm_get_material(Attrs){

		//console.log(Attrs);
		let target_color = 0x878787;
		let is_find = false;

		for (const [key, value] of Object.entries(Attrs)) 
		{
			//console.log("Key = " + key + " Value = " + value);
			if (key == "building" && value.length > 0) target_color = 0xffaaaa;
			if (key == "natural")
			{
				switch (value)
				{
					case "beach": case "heath": case "scree": target_color = 0xf1f4c7; break;
					case "fell": target_color = 0xbbbbbb; break;
					case "grassland": case "grassland": target_color = 0xbadd69; break;
					case "sand": target_color = 0xfdbf6f; break;
					case "wood": target_color = 0xadd3a5; break;
					case "water": target_color = 0xb5d2d6; break;
				}
			}
			if (key == "landuse")
			{
				switch (value)
				{
					case "grass": target_color = 0xbadd69; break;
					case "quarry": target_color = 0xfdbf6f; break;
				}
			}
		}

		//return target_color;
		return new THREE.MeshPhongMaterial({ color: target_color });
	}

	/**
	 * Clear resources fro loaded OSM-data
	 */
	ClearData(){
		this.#osm_nodes = {};
		this.#osm_offset_point = [0.0, 0.0];
		this.#osm_ways = {};
		this.OSM_Features = [];
	}

	/**
	 * Get OSM_Feature instance by it's id or null if that no exists
	 * @param {*} id The OSM's id of item
	 * @returns 
	 */
	GetFeatureById(id){
		for (let i = 0; i < this.OSM_Features.length; i++){
			let osm_item = this.OSM_Features[i];
			if (osm_item.Id == id) return osm_item;
		}
		return null;
	}

	/**
	 * Print to browser's console info about ojects's attributes and tags
	 * @param {*} OSM_Feature_item 
	 */
	PrintSemantic(OSM_Feature_item){
		console.clear();
		console.log('\n'.repeat('25'));
		console.log("Semantic info:");
		console.log("Own attributes:");
		for (const [key, value] of Object.entries(OSM_Feature_item.Attributes))
		{
			console.log(key + " : " + value);
		} 
		console.log("Own tags:");
		for (const [key, value] of Object.entries(OSM_Feature_item.Properties))
		{
			console.log(key + " : " + value);
		} 

	}
}
