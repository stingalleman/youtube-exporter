FROM node:latest

ENV CLIENTSECRET unknown
ENV CLIENTID unknown
ENV REDIRECTURL http://localhost:9101

EXPOSE 9101

WORKDIR /usr/src/youtube-exporter

COPY package*.json ./

RUN npm install
COPY . .

CMD [ "npm", "start" ]