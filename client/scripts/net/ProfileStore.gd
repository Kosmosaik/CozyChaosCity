extends Node
class_name ProfileStore

# Where profiles are stored
const PROFILES_DIR := "user://profiles/"

static func _ensure_dir() -> void:
	DirAccess.make_dir_recursive_absolute(PROFILES_DIR)

static func profile_path(profile_name: String) -> String:
	_ensure_dir()
	var safe := profile_name.strip_edges()
	# (Optional) you can sanitize characters later
	return PROFILES_DIR + safe + ".json"

static func load_profile(profile_name: String) -> Dictionary:
	var path := profile_path(profile_name)
	if not FileAccess.file_exists(path):
		return {}
	var f := FileAccess.open(path, FileAccess.READ)
	var txt := f.get_as_text()
	var data = JSON.parse_string(txt)
	return data if typeof(data) == TYPE_DICTIONARY else {}

static func save_profile(profile_name: String, data: Dictionary) -> void:
	var path := profile_path(profile_name)
	var f := FileAccess.open(path, FileAccess.WRITE)
	f.store_string(JSON.stringify(data, "  "))
