<?php
/**
 * This is a script built to convert one specific spreadsheet I had (i.e. it makes a LOT of assumptions).
 * It is included as a starting point for your own use, but will probably require significant modification.
 */
// Generates JSON 'entries' array suitable for import into the Data Editor when Categories and Filters have already been created or imported.
$input = 'bestiary.csv';
$output = 'bestiary.json';
$delimiter = ',';

// 0-indexed column-to-variable mappings
$csv_map = array(
	'name' => 2,
	'weight' => null,
	'weight_id' => 9,
	'ref_src' => 0,
	'ref_page' => 1,
	// The following will be mapped automatically from the CSV header row:
	'filters' => array(
		'Climate' => array(),
		'Elevation' => array(),
		'Terrain' => array(),
	),
);

// Expected data values as keys and corresponding 'weight_id' array index as values
$weights = array(
	'Ubiquitous' => 0,
	'Common' => 1,
	'Frequent' => 2,
	'Infrequent' => 3,
	'Sporadic' => 4,
	'Unusual' => 5,
	'Scarce' => 6,
	'Exotic' => 7,
);

// Expected mappings for filters, each filter value mapped to the corresponding array index
$filters = array(
	'Climate' => array(
		'Arctic' => 0,
		'Subarctic' => 1,
		'Cool Temperate' => 2,
		'Warm Temperate' => 3,
		'Subtropical' => 4,
		'Tropical' => 5,
	),
	'Elevation' => array(
		'Alpine' => 0,
		'Subalpine' => 1,
		'Montane' => 2,
		'Submontane' => 3,
		'Lowlands' => 4,
	),
	'Terrain' => array(
		'Desert' => 0,
		'Desert Scrub' => 1,
		'Grassland' => 2,
		'Woodland' => 3,
		'Forest' => 4,
		'Wetlands' => 5,
		'Coastal' => 6,
		'Marine' => 7,
		'Subterranean' => 8,
		'Urban' => 9,
	),
);

// Fetch file
$fp = fopen($input, "r");
if (!($fp)) {
	die("Invalid file name: {$input}");
}

// Fetch header row
$length = 8000;
$header = fgetcsv($fp, $length, $delimiter);
if ($header === null) {
	die("Invalid file handle: {$input}");
} elseif (!is_array($header)) {
	die("Unknown error reading file: {$input}");
} elseif (empty($header) || empty($header[0])) {
	die("Missing header for file: {$input}");
}
// Build mappings based on header
foreach ($header as $i => $key) {
	foreach ($filters as $filter => $values) {
		if (!empty($values[$key])) {
			$csv_map['filters'][$filter][$key] = $i;
			break(1);
		}
	}
}

// Process rows
$data = array();
$auto = array('name', 'ref_src', 'ref_page');
while (($row = fgetcsv($fp, $length, $delimiter)) !== false) {
	$entry = array();
	$entry['name'] = $row[$csv_map['name']];
	if (isset($csv_map['weight'])) {
		$weight = filter_var($row[$csv_map['weight']], FILTER_VALIDATE_INT);
		if ($weight > 1) {
			$entry['weight'] = $weight;
		}
	}
	if (isset($csv_map['weight_id']) && array_key_exists($row[$csv_map['weight_id']], $weights)) {
		$entry['weight_id'] = $weights[$row[$csv_map['weight_id']]];
	}
	if (isset($csv_map['ref_src']) && $row[$csv_map['ref_src']] !== '') {
		$entry['ref_src'] = $row[$csv_map['ref_src']];
	}
	if (isset($csv_map['ref_page']) && $row[$csv_map['ref_page']] !== '') {
		$entry['ref_page'] = $row[$csv_map['ref_page']];
	}
	$entry_filters = array();
	foreach ($csv_map['filters'] as $filter_key => $values) {
		$entry_filter = array();
		foreach ($values as $value_key => $row_index) {
			if (!empty($row[$row_index])) {
				$entry_filter[] = $filters[$filter_key][$value_key];
			}
		}
		if (!empty($entry_filter)) {
			$entry_filters[] = array($filter_key, $entry_filter);
		}
	}
	if (!empty($entry_filters)) {
		// Replicate JavaScript Map data format
		$entry['filters'] = array('dataType' => 'Map', 'value' => $entry_filters);
	}
	$data[] = $entry;
}

fclose($fp);

// Write JSON to file
$json = json_encode(array('entries'=>$data));
file_put_contents($output, $json);

echo "<p>$output written successfully.</p>";
