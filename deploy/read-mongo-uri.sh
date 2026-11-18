# shellcheck shell=bash
# Sourced by deploy-gcp.sh and check-atlas.sh: asks for the MongoDB Atlas
# connection string and sets MONGO_URI.
#
# Easiest way: paste the string exactly as Atlas shows it (with <db_password>
# inside), then paste the password at the second, hidden prompt. The password
# is URL-encoded (so characters like @ : / ? # % are safe) and put in place of
# <db_password>. A string that already contains the password works too.
# Nothing is written to a file.

urlencode_value() {
  local text="$1" encoded="" char index
  local LC_ALL=C
  for ((index = 0; index < ${#text}; index += 1)); do
    char="${text:index:1}"
    case "$char" in
      [a-zA-Z0-9.~_-]) encoded+="$char" ;;
      *) printf -v char '%%%02X' "'$char"; encoded+="$char" ;;
    esac
  done
  printf '%s' "$encoded"
}

read_mongo_uri() {
  # The string without the password is not secret: it can be given up front
  # (MONGO_URI_TEMPLATE), so only the password has to be typed.
  if [ -n "${MONGO_URI_TEMPLATE:-}" ]; then
    MONGO_URI="$MONGO_URI_TEMPLATE"
  else
    echo
    echo "Step 1: paste the MongoDB Atlas connection string, exactly as Atlas shows it"
    echo "        (mongodb+srv://USER:<db_password>@...), then press Enter."
    read -r -p "Connection string: " MONGO_URI
  fi
  MONGO_URI="${MONGO_URI//[[:space:]]/}"
  case "$MONGO_URI" in
    mongodb+srv://*|mongodb://*) ;;
    *) echo "That does not look like a MongoDB connection string (it should start with mongodb+srv://)." >&2; return 1 ;;
  esac
  case "$MONGO_URI" in
    *"<db_username>"*|*"<username>"*)
      echo
      echo "The string has no user name. Paste the database user name (Atlas → Database Access),"
      echo "for example something_db_user, then press Enter."
      local user
      read -r -p "User name: " user
      user="${user//[[:space:]]/}"
      if [ -z "$user" ]; then
        echo "No user name was entered." >&2
        return 1
      fi
      MONGO_URI="${MONGO_URI/<db_username>/$(urlencode_value "$user")}"
      MONGO_URI="${MONGO_URI/<username>/$(urlencode_value "$user")}"
      ;;
  esac
  local placeholder=""
  case "$MONGO_URI" in
    *"<db_password>"*) placeholder="<db_password>" ;;
    *"<password>"*) placeholder="<password>" ;;
  esac
  if [ -n "$placeholder" ]; then
    echo
    echo "Paste the MongoDB database password, then press Enter."
    echo "(Hidden: nothing appears while you paste, that is normal.)"
    local password=""

    for _ in 1 2 3; do
      read -r -s -p "Password: " password; echo
      password="${password//[[:space:]]/}"
      [ -n "$password" ] && break
      echo "Nothing was pasted. Click inside this window, paste (Ctrl+V or right-click), then press Enter."
    done
    if [ -z "$password" ]; then
      echo "No password was entered." >&2
      return 1
    fi
    MONGO_URI="${MONGO_URI/"$placeholder"/$(urlencode_value "$password")}"
    unset password
  fi
  export MONGO_URI
}
