FROM ubuntu:latest

WORKDIR /usr/app
COPY ./ /usr/app
RUN apt-get update \
&& apt-get -y install curl \
&& apt-get install -y build-essential \
&& apt-get install -y python3 \
&& curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash \ 
&& export NVM_DIR="$HOME/.nvm" \
&& [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" \
&& [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" \
&& nvm install 22